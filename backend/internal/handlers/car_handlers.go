package handlers

import (
	"net/http"

	"carpaintr/data"
	"carpaintr/internal/middleware"
	"github.com/gorilla/mux"
)

func CarMakesHandler(w http.ResponseWriter, r *http.Request) {
	carBrands, err := data.ListCarBrands(data.CreateEnvPathConfig())
	if err != nil {
		middleware.HandleError(w, err, http.StatusInternalServerError)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, carBrands)
}

func CarModelsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	make := vars["make"]

	models, err := data.ReadCarYamlFile(make, data.CreateEnvPathConfig())
	if err != nil {
		middleware.HandleError(w, err, http.StatusInternalServerError)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, models)
}

func HandleGet(w http.ResponseWriter, r *http.Request) {
	// Placeholder handler for generic get request
	middleware.RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Authenticated access granted",
	})
}

func HandleSeason(w http.ResponseWriter, r *http.Request) {
	season, seasonData, err := data.GetCurrentSeason(data.CreateEnvPathConfig())
	if err != nil {
		middleware.HandleError(w, err, http.StatusInternalServerError)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"season":  season,
		"details": seasonData,
	})
}

func HandleBaseColors(w http.ResponseWriter, r *http.Request) {
	colors, err := data.GetBaseColors(data.CreateEnvPathConfig())
	if err != nil {
		middleware.HandleError(w, err, http.StatusInternalServerError)
		return
	}

	middleware.RespondJSON(w, http.StatusOK, colors)
}
