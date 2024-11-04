package data

import (
	"carpaintr/utils"
	"errors"
	"os"
	"path"
	"strings"
)

type PathConfig struct {
	Origin       string
	Redefinition *string
}

func CreatePathConfig(origin string, redefinition string) PathConfig {
	return PathConfig{Origin: origin, Redefinition: &redefinition}
}

func CreateSimplePathConfig(origin string) PathConfig {
	return PathConfig{Origin: origin, Redefinition: nil}
}

func CreateEnvPathConfig() PathConfig {
	return PathConfig{Origin: GetOriginDataPath(), Redefinition: nil}
}

func GetFilePath(config PathConfig, filePath string) (string, error) {
	// try to find redefinition file
	if config.Redefinition != nil {
		realPath := path.Join(*config.Redefinition, filePath)
		if _, err := os.Stat(realPath); errors.Is(err, os.ErrNotExist) {
			// file does not exist
		} else {
			return realPath, nil
		}
	}
	realPath := path.Join(config.Origin, filePath)
	if _, err := os.Stat(realPath); errors.Is(err, os.ErrNotExist) {
		return "", err
	} else {
		return realPath, nil
	}
}

func ListFilesDistinctWithSuffix(config PathConfig, dirPath string, suffix string) ([]string, error) {
	mainPath := path.Join(config.Origin, dirPath)
	files, err := listFileNamesWithSuffix(mainPath, suffix)
	if err != nil {
		return nil, err
	}
	if config.Redefinition != nil {
		if _, err := os.Stat(path.Join(*config.Redefinition, dirPath)); !os.IsNotExist(err) {
			filesSecond, err := listFileNamesWithSuffix(mainPath, suffix)
			if err != nil {
				return nil, err
			}
			// merge results
			files = utils.MergeUnique(files, filesSecond)
		}
	}
	return files, nil
}

func listFileNamesWithSuffix(path string, suffix string) ([]string, error) {
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	var files []string

	for _, e := range entries {
		if strings.HasSuffix(e.Name(), suffix) {
			files = append(files, strings.ReplaceAll(e.Name(), suffix, ""))
		}
	}

	return files, nil
}
