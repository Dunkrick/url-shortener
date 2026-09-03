package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

type CreateURLRequest struct {
	URL string `json:"url"`
}

type Server struct {
	db      *pgx.Conn
	baseURL string
}

func connectDB() (*pgx.Conn, error) {
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

	conn, err := pgx.Connect(context.Background(), connectionString)
	if err != nil {
		return nil, err
	}

	return conn, nil
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

	http.Redirect(w, r, longURL, http.StatusFound)
}

func startServer(s *Server) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	addr := ":" + port

	http.HandleFunc("/api/v1/urls", s.createURLHandler)
	http.HandleFunc("/", s.redirectHandler)

	fmt.Printf("Server listening on %s\n", addr)

	err := http.ListenAndServe(addr, nil)
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
	defer db.Close(context.Background())

	fmt.Println("Database Connected!")

	server := &Server{
		db:      db,
		baseURL: baseURL,
	}

	startServer(server)
}
