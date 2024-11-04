package data

import (
	"io/ioutil"

	"gopkg.in/yaml.v3"
)

type Color struct {
	Hex    string `yaml:"hex"`
	Rarity string `yaml:"rarity"`
}

func GetBaseColors(config PathConfig) (map[string]Color, error) {
	filePath, err := GetFilePath(config, "global/colors.yaml")
	if err != nil {
		return nil, err
	}

	data, err := ioutil.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	colors := make(map[string]Color)
	err = yaml.Unmarshal(data, colors)
	if err != nil {
		return nil, err
	}

	return colors, nil
}
