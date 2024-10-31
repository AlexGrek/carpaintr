package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/gorilla/mux"
)

func GetCatalogsHandler(w http.ResponseWriter, r *http.Request) {
	level := AuthLevelAsNumeric(getAccessLevelIfLoggedIn(r))

	includeHidden, includeUnpubliched := false, false

	if (level >= AuthLevelAsNumeric(ACCESS_READER)) {
		// logged in at least
		includeHidden = true
	}
	if (level >= AuthLevelAsNumeric(ACCESS_MASTER)) {
		// only master level access
		includeUnpubliched = true
	}

	// Return a response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(TextHierarchy(includeHidden, includeUnpubliched))
}

func GetOneCatalogHandler(w http.ResponseWriter, r *http.Request) {
	// Return a response
	vars := mux.Vars(r)
	directory := vars["directory"]

	w.Header().Set("Content-Type", "application/json")
	name, catalog := TextHierarchyOneDir(directory)
	json.NewEncoder(w).Encode(map[string]interface{}{"path": name, "catalog": catalog})
}

func HandleTextFileRequest(w http.ResponseWriter, r *http.Request) {
	// Extract directory and filename from the URL path
	vars := mux.Vars(r)
	directory := vars["directory"]
	filename := vars["filename"]
	rootPath := os.Getenv("TEXT_PATH")
	if rootPath == "" {
		rootPath = "demotexts"
	}
	filePath := fmt.Sprintf("%s/%s/%s", rootPath, directory, filename)

	_, catalog := TextHierarchyOneDir(directory)
	if catalog.Protected {
		// Check if the user is authenticated
		if !checkLoggedIn(w, r, ACCESS_READER) {
			return
		}
	}

	// Read the contents of the text file
	fileContents, err := os.ReadFile(filePath)
	if err != nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	// Send the file contents as the response
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	w.Write(fileContents)
}

type AppendPayload struct {
	Catalog string `json:"catalog"`
	File    string `json:"file"`
	Text    string `json:"text"`
}

type EditTextPayload struct {
	Catalog string `json:"catalog"`
	File    string `json:"file"`
	Rename  string `json:"rename"`
	Text    string `json:"text"`
}

type DeleteTextPayload struct {
	Catalog string `json:"catalog"`
	File    string `json:"file"`
}

type UpdateMetadataPayload struct {
	Catalog string `json:"catalog"`
	Tags        []string `json:"tags"`
	Description string   `json:"description"`
	Protected   bool     `json:"protected"`
	Hidden      bool     `json:"hidden"`
	Unpublished bool     `json:"unpublished"`
}


type CreatePayload struct {
	Catalog     string   `json:"catalog"`
	File        string   `json:"file"`
	Text        string   `json:"text"`
	Tags        []string `json:"tags"`
	Description string   `json:"description"`
	Protected   bool     `json:"protected"`
}

func HandleCreate(w http.ResponseWriter, r *http.Request) {
	// Read the request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Error reading request body", http.StatusBadRequest)
		return
	}

	if !checkLoggedIn(w, r, ACCESS_CONTRIBUTOR) {
		return
	}

	var catalogInfo CreatePayload
	if err := json.Unmarshal(body, &catalogInfo); err != nil {
		http.Error(w, "Error decoding JSON", http.StatusBadRequest)
		return
	}

	// Create the directory for the catalog if it doesn't exist
	// Create the file with the given file name inside the catalog directory
	// Create and write tags to metadata.json in the catalog directory
	_, err = CreateNewCatalogAndFile(catalogInfo)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		fmt.Println(err)
		return
	}

	// Send success response
	w.WriteHeader(http.StatusCreated)
	w.Write([]byte("Catalog and file created successfully"))
}

func HandleDeleteText(w http.ResponseWriter, r *http.Request) {
	// Read the request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Error reading request body", http.StatusBadRequest)
		return
	}

	if !checkLoggedIn(w, r, ACCESS_MASTER) {
		return
	}

	var catalogInfo DeleteTextPayload
	if err := json.Unmarshal(body, &catalogInfo); err != nil {
		http.Error(w, "Error decoding JSON", http.StatusBadRequest)
		return
	}

	err = DeleteFileAndCheckDir(catalogInfo)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		fmt.Println(err)
		return
	}

	// Send success response
	w.WriteHeader(http.StatusAccepted)
	w.Write([]byte("Text deleted"))
}

func HandleEditMetadata(w http.ResponseWriter, r *http.Request) {
	// Read the request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Error reading request body", http.StatusBadRequest)
		return
	}

	if !checkLoggedIn(w, r, ACCESS_MASTER) {
		return
	}

	var catalogInfo UpdateMetadataPayload
	if err := json.Unmarshal(body, &catalogInfo); err != nil {
		http.Error(w, "Error decoding JSON", http.StatusBadRequest)
		return
	}

	err = UpdateMetadata(catalogInfo)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		fmt.Println(err)
		return
	}

	// Send success response
	w.WriteHeader(http.StatusAccepted)
	w.Write([]byte("Metadata changed"))
}


func HandleEditText(w http.ResponseWriter, r *http.Request) {
	// Read the request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Error reading request body", http.StatusBadRequest)
		return
	}

	if !checkLoggedIn(w, r, ACCESS_MASTER) {
		return
	}

	var catalogInfo EditTextPayload
	if err := json.Unmarshal(body, &catalogInfo); err != nil {
		http.Error(w, "Error decoding JSON", http.StatusBadRequest)
		return
	}

	err = EditTextFile(catalogInfo)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		fmt.Println(err)
		return
	}

	// Send success response
	w.WriteHeader(http.StatusAccepted)
	w.Write([]byte("Text updated"))
}

func HandleAppend(w http.ResponseWriter, r *http.Request) {
	// Read the request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Error reading request body", http.StatusBadRequest)
		return
	}

	if !checkLoggedIn(w, r, ACCESS_CONTRIBUTOR) {
		return
	}

	var catalogInfo AppendPayload
	if err := json.Unmarshal(body, &catalogInfo); err != nil {
		http.Error(w, "Error decoding JSON", http.StatusBadRequest)
		return
	}

	// Create the file with the given file name inside the catalog directory
	err = AddFileToCatalog(catalogInfo)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		fmt.Println(err)
		return
	}

	// Send success response
	w.WriteHeader(http.StatusCreated)
	w.Write([]byte("Catalog and file created successfully"))
}


