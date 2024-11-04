package data

import (
	"io/ioutil"
	"path"

	"gopkg.in/yaml.v3"
)

// Define a struct for the fields we want to extract
type Car struct {
	Body  []string `yaml:"body"`
	Class string   `yaml:"class"`
	Gen   []string `yaml:"gen"`
	IsSUV bool     `yaml:"is_suv"`
}

func ReadCarYamlFile(filenameWithoutExtension string, config PathConfig) (map[string]Car, error) {
	// Read YAML file
	filePath, err := GetFilePath(config, path.Join("cars", filenameWithoutExtension+".yaml"))
	if err != nil {
		return nil, err
	}
	data, err := ioutil.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	// Parse YAML data into a map of car models
	var cars map[string]Car
	err = yaml.Unmarshal(data, &cars)
	if err != nil {
		return nil, err
	}

	return cars, nil
}

func ListCarBrands(config PathConfig) ([]string, error) {
	return ListFilesDistinctWithSuffix(config, "cars/", ".yaml")
}
