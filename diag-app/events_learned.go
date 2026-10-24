package main

import (
	"sort"
	"strconv"
	"strings"
	"sync"
)

// Événements appris : ce que les techniciens ont appris à PC2 Diag sur des
// événements que evKB ne connaît pas. Les fiches sont rangées sur le site
// (/api/diag-app/event-notes), donc partagées par toutes les applications
// associées ; une copie reste à côté de l'exe pour travailler hors ligne.

type evNote struct {
	ID        int      `json:"id,omitempty"`
	Source    string   `json:"source"`
	EventID   int      `json:"event_id"`
	Sev       string   `json:"sev"`
	Noise     bool     `json:"noise"`
	Title     string   `json:"title"`
	Explain   string   `json:"explain"`
	Advice    string   `json:"advice,omitempty"`
	Causes    []string `json:"causes"`
	By        string   `json:"by,omitempty"`
	UpdatedAt string   `json:"updated_at,omitempty"`
}

var evLearned struct {
	sync.RWMutex
	notes map[string]evNote
}

func evNoteKey(src string, id int) string { return strings.ToLower(src) + "|" + strconv.Itoa(id) }

// setLearned remplace toutes les fiches (liste reçue du site ou lue dans la copie).
func setLearned(notes []evNote) {
	m := make(map[string]evNote, len(notes))
	for _, n := range notes {
		if n.Source != "" && n.Title != "" {
			m[evNoteKey(n.Source, n.EventID)] = n
		}
	}
	evLearned.Lock()
	evLearned.notes = m
	evLearned.Unlock()
}

// upsertLearned ajoute ou remplace une fiche, juste après l'avoir enregistrée sur le site.
func upsertLearned(n evNote) {
	evLearned.Lock()
	if evLearned.notes == nil {
		evLearned.notes = map[string]evNote{}
	}
	evLearned.notes[evNoteKey(n.Source, n.EventID)] = n
	evLearned.Unlock()
}

func learnedNotes() []evNote {
	evLearned.RLock()
	out := make([]evNote, 0, len(evLearned.notes))
	for _, n := range evLearned.notes {
		out = append(out, n)
	}
	evLearned.RUnlock()
	sort.Slice(out, func(i, j int) bool {
		if !strings.EqualFold(out[i].Source, out[j].Source) {
			return strings.ToLower(out[i].Source) < strings.ToLower(out[j].Source)
		}
		return out[i].EventID < out[j].EventID
	})
	return out
}

// learnedLookup : la fiche apprise d'un événement (nil s'il n'y en a pas).
func learnedLookup(src string, id int) *evNote {
	evLearned.RLock()
	defer evLearned.RUnlock()
	if n, ok := evLearned.notes[evNoteKey(src, id)]; ok {
		return &n
	}
	return nil
}
