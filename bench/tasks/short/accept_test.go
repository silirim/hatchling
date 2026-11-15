package catalog

import "testing"

// The bench copies this file into the run's clone after the session: the agent never sees it.
func TestAccept(t *testing.T) {
	cases := []struct {
		raw   string
		title string
		year  int
	}{
		{"Heat [1995] 4K", "Heat", 1995},
		{"Heat [1995]", "Heat", 1995},
		{"1408 (2007) 4K", "1408", 2007},
		{"[REC]", "[REC]", 0},
		{"Blade Runner 2049", "Blade Runner 2049", 0},
		{"Film [ITA]", "Film", 0},
	}
	for _, c := range cases {
		if title, year := CleanTitle(c.raw); title != c.title || year != c.year {
			t.Errorf("%q → (%q, %d), want (%q, %d)", c.raw, title, year, c.title, c.year)
		}
	}
}
