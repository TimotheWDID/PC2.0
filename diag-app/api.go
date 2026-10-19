package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client talks to the site's /api/diag-app endpoints with the pairing key.
type Client struct {
	Server  string
	Token   string
	Machine string
	http    *http.Client
}

func NewClient(server, token, machine string) *Client {
	return &Client{Server: NormalizeServer(server), Token: token, Machine: machine, http: &http.Client{Timeout: 60 * time.Second}}
}

// NormalizeServer keeps scheme and host (https by default), without trailing slash.
func NormalizeServer(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if !strings.Contains(s, "://") {
		s = "https://" + s
	}
	u, err := url.Parse(s)
	if err != nil || u.Host == "" {
		return strings.TrimRight(s, "/")
	}
	return strings.TrimRight(u.Scheme+"://"+u.Host+u.Path, "/")
}

type Me struct {
	User    string `json:"user"`
	Site    string `json:"site"`
	URL     string `json:"url"`
	KeyName string `json:"key_name"`
}

type Ticket struct {
	ID     int    `json:"id"`
	Title  string `json:"title"`
	Status string `json:"status"`
	Client string `json:"client"`
	Device string `json:"device"`
	URL    string `json:"url"`
}

type SendResult struct {
	ID            int              `json:"id"`
	Ticket        *Ticket          `json:"ticket"`
	ReportURL     string           `json:"report_url"`
	TicketURL     string           `json:"ticket_url"`
	ListURL       string           `json:"list_url"`
	Device        map[string]any   `json:"device"`
	DeviceCreated bool             `json:"device_created"`
	Filled        []string         `json:"filled"`
	Conflicts     []map[string]any `json:"conflicts"`
	Warnings      []string         `json:"warnings"`
}

func (c *Client) Me() (*Me, error) {
	var me Me
	return &me, c.do("GET", "/me", nil, &me)
}

func (c *Client) Tickets(q string) ([]Ticket, error) {
	var out struct {
		Tickets []Ticket `json:"tickets"`
	}
	err := c.do("GET", "/tickets?q="+url.QueryEscape(q), nil, &out)
	return out.Tickets, err
}

func (c *Client) Ticket(id int) (*Ticket, error) {
	var out struct {
		Ticket Ticket `json:"ticket"`
	}
	if err := c.do("GET", fmt.Sprintf("/tickets/%d", id), nil, &out); err != nil {
		return nil, err
	}
	return &out.Ticket, nil
}

func (c *Client) Send(ticketID int, report Report, inventory map[string]any) (*SendResult, error) {
	body := map[string]any{"report": report, "inventory": inventory}
	if ticketID > 0 {
		body["ticket_id"] = ticketID
	}
	var res SendResult
	return &res, c.do("POST", "/diagnostics", body, &res)
}

func (c *Client) do(method, path string, body any, out any) error {
	if c.Server == "" || c.Token == "" {
		return errors.New("application non associée au site")
	}
	var rd io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.Server+"/api/diag-app"+path, rd)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "PC2Diag/"+Version)
	if c.Machine != "" {
		req.Header.Set("X-Diag-Machine", c.Machine)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("site injoignable : %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	if resp.StatusCode >= 300 {
		return apiError(resp.StatusCode, raw)
	}
	if out != nil {
		if err := json.Unmarshal(raw, out); err != nil {
			return fmt.Errorf("réponse inattendue du site (%d) : vérifiez l'adresse", resp.StatusCode)
		}
	}
	return nil
}

func apiError(status int, raw []byte) error {
	var e struct {
		Message string              `json:"message"`
		Errors  map[string][]string `json:"errors"`
	}
	if json.Unmarshal(raw, &e) == nil {
		for _, msgs := range e.Errors {
			if len(msgs) > 0 {
				return errors.New(msgs[0])
			}
		}
		if e.Message != "" {
			return errors.New(e.Message)
		}
	}
	switch status {
	case 401:
		return errors.New("clé d'accès refusée : associez à nouveau l'application")
	case 404:
		return errors.New("adresse du site incorrecte (API introuvable)")
	case 413:
		return errors.New("rapport trop volumineux pour le serveur")
	}
	return fmt.Errorf("erreur du site (HTTP %d)", status)
}
