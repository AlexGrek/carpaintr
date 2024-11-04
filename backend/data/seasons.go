package data

import (
	"fmt"
	"io/ioutil"
	"time"

	"gopkg.in/yaml.v3"
)

type SeasonConfig struct {
	DateFrom               string  `yaml:"date_from"`
	DateTo                 string  `yaml:"date_to"`
	EstFuelConsForPaintDry float64 `yaml:"est_fuel_cons_for_paint_dry"`
	EstFuelConsForBaseDry  float64 `yaml:"est_fuel_cons_for_base_dry"`
}

func determineSeason(seasonConfig map[string]SeasonConfig) (string, *SeasonConfig, error) {
	today := time.Now()

	for season, config := range seasonConfig {
		dateFrom, err := time.Parse("02.01", config.DateFrom)
		if err != nil {
			return "", nil, err
		}
		dateTo, err := time.Parse("02.01", config.DateTo)
		if err != nil {
			return "", nil, err
		}

		if (today.Month() == dateFrom.Month() && today.Day() >= dateFrom.Day()) ||
			(today.Month() == dateTo.Month() && today.Day() < dateTo.Day()) {
			return season, &config, nil
		}
	}

	return "", nil, fmt.Errorf("could not determine current season")
}

func GetCurrentSeason(config PathConfig) (string, *SeasonConfig, error) {
	filePath, err := GetFilePath(config, "global/seasons.yaml")
	if err != nil {
		return "", nil, err
	}

	data, err := ioutil.ReadFile(filePath)
	if err != nil {
		return "", nil, err
	}

	seasonConfig := make(map[string]SeasonConfig)
	err = yaml.Unmarshal(data, seasonConfig)
	if err != nil {
		return "", nil, err
	}

	season, seasonData, err := determineSeason(seasonConfig)
	if err != nil {
		return "", nil, err
	}

	return season, seasonData, nil
}
