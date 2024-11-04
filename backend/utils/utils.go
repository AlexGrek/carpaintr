package utils

func MergeUnique(slice1, slice2 []string) []string {
	// Map to track unique elements from the first slice
	uniqueMap := make(map[string]bool)
	result := make([]string, 0, len(slice1)+len(slice2)) // Pre-allocate space

	// Add elements from the first slice to result and track in uniqueMap
	for _, val := range slice1 {
		if !uniqueMap[val] {
			uniqueMap[val] = true
			result = append(result, val)
		}
	}

	// Add only new elements from the second slice
	for _, val := range slice2 {
		if !uniqueMap[val] {
			uniqueMap[val] = true
			result = append(result, val)
		}
	}

	return result
}
