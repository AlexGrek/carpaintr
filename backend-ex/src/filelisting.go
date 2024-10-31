package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

type Catalog struct {
	Files       []string `json:"files"`
	Tags        []string `json:"tags"`
	Description string   `json:"description"`
	PrettyName  string   `json:"prettyName"`
	Pages       int64    `json:"pages"`
	Protected   bool     `json:"protected"`
	Hidden      bool     `json:"hidden"`
	Unpublished bool     `json:"unpublished"`
}

type Metadata struct {
	Tags        []string `json:"tags"`
	Description string   `json:"description"`
	Protected   bool     `json:"protected"`
	Hidden      bool     `json:"hidden"`
	Unpublished bool     `json:"unpublished"`
}

func GenerateHierarchy(rootPath string, includeUnpublished bool, includeHidden bool) (map[string]Catalog, error) {
	result := make(map[string]Catalog)

	// Get list of directories in the rootPath
	dirs, err := os.ReadDir(rootPath)
	if err != nil {
		return nil, err
	}

	for _, dir := range dirs {
		if dir.IsDir() {
			catalogName := dir.Name()
			catalogName, catalog := GenerateCatalog(catalogName, rootPath)
			if catalog.Hidden && !includeHidden {
				continue
			}
			if catalog.Unpublished && !includeUnpublished {
				continue
			}
			result[catalogName] = catalog
		}
	}

	return result, nil
}

func GenerateCatalog(catalogName string, rootPath string) (string, Catalog) {
	catalog := Catalog{
		Files:       []string{},
		Tags:        []string{},
		Description: "",
		PrettyName:  "",
		Pages:       0,
	}
	catalog.Description = ""
	catalog.Tags = make([]string, 0)
	catalog.PrettyName = ConvertIntoStoryNameString(catalogName)

	files, err := os.ReadDir(filepath.Join(rootPath, catalogName))
	if err != nil {
		log.Println(err)
		catalog.PrettyName = err.Error()
		return catalogName, catalog
	}

	for _, file := range files {
		if !file.IsDir() && filepath.Ext(file.Name()) == ".txt" {
			catalog.Files = append(catalog.Files, file.Name())
		}
	}

	// Check if metadata.json exists, if not create it
	metadataFilePath := filepath.Join(rootPath, catalogName, "metadata.json")
	if _, err := os.Stat(metadataFilePath); os.IsNotExist(err) {
		if err := createMetadataFile(metadataFilePath, &Metadata{
			Tags:        make([]string, 0),
			Description: "",
			Protected:   true,
			Unpublished: false,
			Hidden:      false,
		}); err != nil {
			log.Println(err)
		}
	}

	meta, err := readMetadataFile(metadataFilePath)
	if err != nil {
		log.Println(err)
	} else {
		catalog.Description = meta.Description
		catalog.Tags = meta.Tags
		catalog.Protected = meta.Protected
		catalog.Hidden = meta.Hidden
		catalog.Unpublished = meta.Unpublished
	}

	size, err := calculateTotalTxtFileSize(filepath.Join(rootPath, catalogName))
	if err == nil {
		catalog.Pages = size / 2000
	}
	return catalogName, catalog
}

func readMetadataFile(filePath string) (Metadata, error) {
	data := Metadata{}
	file, err := os.Open(filePath)
	if err != nil {
		return data, err
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&data); err != nil {
		return data, err
	}
	return data, nil
}

func createMetadataFile(filePath string, data *Metadata) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	err = encoder.Encode(data)
	if err != nil {
		return err
	}

	log.Println("metadata.json created successfully in", filePath)
	return nil
}

func TextHierarchy(includeHidden bool, includeUnpublished bool) map[string]Catalog {
	rootPath := os.Getenv("TEXT_PATH")
	if rootPath == "" {
		rootPath = "demotexts"
	}
	hierarchy, err := GenerateHierarchy(rootPath, includeUnpublished, includeHidden)
	if err != nil {
		log.Fatal(err)
	}
	return hierarchy
}

func TextHierarchyOneDir(directory string) (string, Catalog) {
	rootPath := os.Getenv("TEXT_PATH")
	if rootPath == "" {
		rootPath = "demotexts"
	}
	name, catalog := GenerateCatalog(directory, rootPath)
	return name, catalog
}

func calculateTotalTxtFileSize(directory string) (int64, error) {
	var totalSize int64
	err := filepath.Walk(directory, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && filepath.Ext(info.Name()) == ".txt" {
			size, err := fileSize(path)
			if err != nil {
				return err
			}
			totalSize += size
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return totalSize, nil
}

func fileSize(path string) (int64, error) {
	fileInfo, err := os.Stat(path)
	if err != nil {
		return 0, err
	}
	return fileInfo.Size(), nil
}

func AddFileToCatalog(catalogInfo AppendPayload) error {
	rootPath := os.Getenv("TEXT_PATH")
	if rootPath == "" {
		rootPath = "demotexts"
	}
	name := ConvertIntoFileNameString(catalogInfo.Catalog)
	catalogDir := catalogPath(ConvertIntoFileNameString(catalogInfo.Catalog))
	if _, err := os.Stat(catalogDir); err != nil {
		fmt.Println("Directory does not exist to append file to:", name)
		return err
	}

	_, catalog := GenerateCatalog(name, rootPath)

	err := createFile(catalogDir, catalogInfo.File, catalogInfo.Text, len(catalog.Files))
	if err != nil {
		return err
	}

	return nil
}

// add os.Getenv("TEXT_PATH") as prefix
func catalogPath(catalogName string) string {
	// Check if catalogName contains ".." or "/", sEcUrItY
    if strings.Contains(catalogName, "..") || strings.Contains(catalogName, "/") || strings.Contains(catalogName, "\\") {
        return "fallback_default_catalog"
    }
	rootPath := os.Getenv("TEXT_PATH")
	if rootPath == "" {
		rootPath = "demotexts"
	}
	return filepath.Join(rootPath, catalogName)
}

func CreateNewCatalogAndFile(catalogInfo CreatePayload) (bool, error) {
	catalogDir := catalogPath(ConvertIntoFileNameString(catalogInfo.Catalog))
	if _, err := os.Stat(catalogDir); os.IsNotExist(err) {
		if err := os.Mkdir(catalogDir, 0755); err != nil {
			return false, err
		}
	}

	err := createFile(catalogDir, catalogInfo.File, catalogInfo.Text, 0)
	if err != nil {
		return false, err
	}

	metadata := Metadata{
		Tags:        catalogInfo.Tags,
		Description: catalogInfo.Description,
		Protected:   catalogInfo.Protected,
	}
	metadataFilePath := filepath.Join(catalogDir, "metadata.json")
	metadataJSON, err := json.MarshalIndent(metadata, "", "    ")
	if err != nil {
		return false, err
	}
	if err := os.WriteFile(metadataFilePath, metadataJSON, 0644); err != nil {
		return false, err
	}
	return true, nil
}

func EditTextFile(payload EditTextPayload) error {
	// edit request processing (and renaming)
	filePath := filepath.Join(catalogPath(payload.Catalog), payload.File)
	if err := overwriteFileWithText(filePath, payload.Text); err != nil {
		return err
	}

	if payload.Rename != "" && payload.File != payload.Rename {
		// mv
		newPath := filepath.Join(catalogPath(payload.Catalog), payload.Rename)
		return os.Rename(filePath, newPath)
	}

	return nil
}

func overwriteFileWithText(filePath string, newText string) error {
	file, err := os.OpenFile(filePath, os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.WriteString(newText)
	if err != nil {
		return err
	}

	return nil
}

func createFile(catalogDir string, file string, text string, existing int) error {
	filePath := filepath.Join(catalogDir, MakeTextFileName(file, existing))
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		if err := os.WriteFile(filePath, []byte(text), 0644); err != nil {
			fmt.Println("Error creating file", err.Error())
			return err
		}
	}
	return nil
}

func DeleteFileAndCheckDir(payload DeleteTextPayload) error {
	// Remove the file
	filePath := filepath.Join(catalogPath(payload.Catalog), payload.File)
	err := os.Remove(filePath)
	if err != nil {
		return err
	}

	// Check if there are any remaining .txt files in the directory
	dir, err := os.Open(catalogPath(payload.Catalog))
	if err != nil {
		return err
	}

	files, err := dir.Readdir(-1)
	if err != nil {
		return err
	}
	dir.Close()

	hasTxt := false
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".txt") {
			hasTxt = true
			break
		}
	}

	// If no .txt files are found, remove the directory
	if !hasTxt {
		err = os.RemoveAll(catalogPath(payload.Catalog))
		if err != nil {
			return err
		}
		fmt.Printf("Directory %s removed\n", payload.Catalog)
	}

	return nil
}

func UpdateMetadata(payload UpdateMetadataPayload) error {
	// Create or open the metadata file
	filePath := filepath.Join(catalogPath(payload.Catalog), "metadata.json")
	metadataFile, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	defer metadataFile.Close()

	// Create metadata struct
	metadata := Metadata{
		Tags:        payload.Tags,
		Description: payload.Description,
		Protected:   payload.Protected,
		Hidden:      payload.Hidden,
		Unpublished: payload.Unpublished,
	}

	// Marshal metadata struct to JSON
	metadataJSON, err := json.MarshalIndent(metadata, "", "    ")
	if err != nil {
		return err
	}

	// Write JSON to file
	_, err = metadataFile.Write(metadataJSON)
	if err != nil {
		return err
	}

	fmt.Printf("Metadata updated for catalog %s\n", payload.Catalog)
	return nil
}
