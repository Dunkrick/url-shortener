package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type CreateURLRequest struct {
	URL string `json:"url"`
}

func createURLHandler(w http.ResponseWriter, r *http.Request) {
	//method check
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	//define request struct
	var req CreateURLRequest

	//body parsing
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	// validate URL
	if req.URL == "" {
		http.Error(w, "url is required", http.StatusBadRequest)
		return
	}
	// create a map for response
	response := map[string]string{
		"url": req.URL,
	}
	//return JSON
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func startServer() {
	http.HandleFunc("/api/v1/urls", createURLHandler)

	fmt.Println("Server listening on :8080")
	http.ListenAndServe(":8080", nil)
}

func main() {
	startServer()
}
