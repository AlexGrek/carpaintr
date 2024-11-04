package yaml_data

import (
	"carpaintr/data"
	"slices"
	"testing"
)

const AUDIS = 19
const BRANDS = 4

func TestCarDataReader(t *testing.T) {
	nullPathConfig := data.CreateSimplePathConfig("../../../data/")
	audis, err := data.ReadCarYamlFile("audi", nullPathConfig)
	if err != nil {
		t.Error(err)
	}
	if len(audis) != AUDIS {
		t.Errorf("Got %d audis, expected %d audis", len(audis), AUDIS)
	}
	if audis["A5"].IsSUV {
		t.Error("A5 should not be an SUV")
	}
}

func TestCarDataRedefinitionReader(t *testing.T) {
	nullPathConfig := data.CreatePathConfig("../../../data/", "../../../data_test/")
	audis, err := data.ReadCarYamlFile("audi", nullPathConfig)
	if err != nil {
		t.Error(err)
	}
	if len(audis) != 3 {
		t.Errorf("Got %d audis, expected %d audis", len(audis), 3)
	}
	if audis["A5"].IsSUV {
		t.Error("A5 should not be an SUV")
	}
}

func TestCarBrandsReader(t *testing.T) {
	nullPathConfig := data.CreatePathConfig("../../../data/", "../../../data_test/")
	brands, err := data.ListCarBrands(nullPathConfig)
	if err != nil {
		t.Error(err)
	}
	if len(brands) != BRANDS {
		t.Errorf("Got %d brands, expected %d", len(brands), BRANDS)
	}
	if !slices.Contains(brands, "audi") {
		t.Error("Audi is a brand")
	}
	if !slices.Contains(brands, "seat") {
		t.Error("Seat is a brand")
	}
}
