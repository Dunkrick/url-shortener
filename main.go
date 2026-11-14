package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

type CreateURLRequest struct {
	URL string `json:"url"`
}

type Server struct {
	db      *pgxpool.Pool
	redis   *redis.Client
	baseURL string
}

// helper for finding Client IP
func getClientIP(r *http.Request) string {
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		return strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}

	return host
}

// implement basic rate limiting for POST requests
func (s *Server) allowRequest(ctx context.Context, clientIP string) (bool, error) {
	if s.redis == nil {
		return true, nil
	}

	window := time.Now().Unix() / 60
	key := fmt.Sprintf("rate_limit:create:%s:%d", clientIP, window)

	count, err := s.redis.Incr(ctx, key).Result()
	if err != nil {
		return false, err
	}

	if count == 1 {
		if err := s.redis.Expire(ctx, key, time.Minute).Err(); err != nil {
			return false, err
		}
	}

	return count <= 100, nil
}

func connectDB() (*pgxpool.Pool, error) {
	if connStr := os.Getenv("DATABASE_URL"); connStr != "" {
		return pgxpool.New(context.Background(), connStr)
	}

	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")

	var connectionString string

	if strings.HasPrefix(host, "/cloudsql/") {
		connectionString = fmt.Sprintf(
			"host=%s user=%s password=%s dbname=%s",
			host,
			user,
			password,
			dbname,
		)
	} else {
		connectionString = fmt.Sprintf(
			"postgres://%s:%s@%s:%s/%s",
			user,
			password,
			host,
			port,
			dbname,
		)
	}

	pool, err := pgxpool.New(context.Background(), connectionString)
	if err != nil {
		return nil, err
	}

	return pool, nil
}

func (s *Server) createURLHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreateURLRequest

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.URL == "" {
		http.Error(w, "url is required", http.StatusBadRequest)
		return
	}

	clientIP := getClientIP(r)

	allowed, err := s.allowRequest(r.Context(), clientIP)

	// 503 - our limiter couldn't operate
	if err != nil {
		http.Error(w, "rate limiting unavailable", http.StatusServiceUnavailable)
		return
	}
	// 429 - limiter worked and deliberately rejected
	if !allowed {
		http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
		return
	}

	query := `
		INSERT INTO urls (long_url)
		VALUES ($1)
		ON CONFLICT (long_url)
		DO UPDATE SET long_url = EXCLUDED.long_url
		RETURNING id
	`

	var id int64

	err = s.db.QueryRow(
		context.Background(),
		query,
		req.URL,
	).Scan(&id)

	if err != nil {
		http.Error(w, "failed to create URL", http.StatusInternalServerError)
		return
	}

	shortCode := encodeBase62(id)
	shortURL := s.baseURL + "/" + shortCode

	response := map[string]string{
		"short_url": shortURL,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

func (s *Server) redirectHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	shortCode := strings.TrimPrefix(r.URL.Path, "/")

	if shortCode == "" {
		http.Error(w, "short code is required", http.StatusBadRequest)
		return
	}

	id, err := decodeBase62(shortCode)
	if err != nil {
		http.Error(w, "invalid short code", http.StatusBadRequest)
		return
	}

	// 1. Check Redis first (if available)
	if s.redis != nil {
		cachedURL, err := s.redis.Get(context.Background(), shortCode).Result()
		if err == nil && cachedURL != "" {
			//CACHE HIT
			s.incrementRedirectCount()
			http.Redirect(w, r, cachedURL, http.StatusFound)
			return
		}
	}

	// 2. Check PostgreSQL
	var longURL string

	err = s.db.QueryRow(
		context.Background(),
		"SELECT long_url FROM urls WHERE id = $1",
		id,
	).Scan(&longURL)

	if err != nil {
		http.Error(w, "URL not found", http.StatusNotFound)
		return
	}

	// 3. Store the result in Redis (if available)
	if s.redis != nil {
		_ = s.redis.Set(
			context.Background(),
			shortCode,
			longURL,
			time.Hour,
		).Err()
	}

	// 4. Redirect
	//URL exists; count the redirect.
	s.incrementRedirectCount()
	http.Redirect(w, r, longURL, http.StatusFound)
}

func isAllowedOrigin(origin string) bool {
	if origin == "https://drabnip.vercel.app" || strings.HasSuffix(origin, ".vercel.app") {
		return true
	}
	if origin == "http://localhost:5173" || origin == "http://localhost:5175" || origin == "http://localhost:3000" {
		return true
	}
	return false
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if isAllowedOrigin(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set(
				"Access-Control-Allow-Methods",
				"GET, POST, OPTIONS",
			)
			w.Header().Set(
				"Access-Control-Allow-Headers",
				"Content-Type",
			)
		}

		if r.Method == http.MethodOptions {
			if origin != "" && !isAllowedOrigin(origin) {
				http.Error(w, "Origin not allowed", http.StatusForbidden)
				return
			}

			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *Server) incrementRedirectCount() {
	if s.redis == nil {
		return
	}

	err := s.redis.Incr(
		context.Background(),
		"stats:total_redirects",
	).Err()

	if err != nil {
		fmt.Println("Failed to increment redirect counter:", err)
	}
}

func (s *Server) statsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var total int64
	if s.redis != nil {
		var err error
		total, err = s.redis.Get(
			context.Background(),
			"stats:total_redirects",
		).Int64()

		if err != nil {
			if err.Error() != "redis: nil" {
				fmt.Println("Warning: failed to retrieve redirect statistics from Redis:", err)
			}
			total = 0
		}
	}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"total_redirects":%d}`+"\n", total)
}

func startServer(s *Server) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	addr := ":" + port

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/urls", s.createURLHandler)
	mux.HandleFunc("/api/v1/stats", s.statsHandler)
	mux.HandleFunc("/", s.redirectHandler)

	handler := corsMiddleware(mux)

	fmt.Printf("Server listening on %s\n", addr)

	err := http.ListenAndServe(addr, handler)
	if err != nil {
		fmt.Println("Server failed:", err)
	}
}

func main() {
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Warning: .env file not found")
	}

	baseURL := os.Getenv("APP_BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}

	db, err := connectDB()
	if err != nil {
		fmt.Println("Database connection failed:", err)
		return
	}
	defer db.Close()

	fmt.Println("Database Connected!")

	var redisClient *redis.Client
	redisURL := os.Getenv("REDIS_URL")
	redisAddr := os.Getenv("REDIS_ADDR")

	if redisURL != "" {
		opt, err := redis.ParseURL(redisURL)
		if err == nil {
			client := redis.NewClient(opt)
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			if err := client.Ping(ctx).Err(); err == nil {
				redisClient = client
				fmt.Println("Redis Connected via REDIS_URL!")
			} else {
				fmt.Printf("Warning: Redis ping failed (%v), running without Redis\n", err)
			}
			cancel()
		} else {
			fmt.Printf("Warning: Failed to parse REDIS_URL (%v), running without Redis\n", err)
		}
	} else if redisAddr != "" {
		client := redis.NewClient(&redis.Options{
			Addr: redisAddr,
		})
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		if err := client.Ping(ctx).Err(); err == nil {
			redisClient = client
			fmt.Println("Redis Connected via REDIS_ADDR!")
		} else {
			fmt.Printf("Warning: Redis ping failed (%v), running without Redis\n", err)
		}
		cancel()
	} else {
		fmt.Println("No Redis configured, running in PostgreSQL-only mode")
	}

	if redisClient != nil {
		defer redisClient.Close()
	}

	server := &Server{
		db:      db,
		baseURL: baseURL,
		redis:   redisClient,
	}

	startServer(server)
}
