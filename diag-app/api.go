package main

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
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
	ID      int    `json:"id"`
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

// EventNotes downloads the events taught to PC2 Diag (events_learned.go).
func (c *Client) EventNotes() ([]evNote, error) {
	var out struct {
		Notes []evNote `json:"notes"`
	}
	err := c.do("GET", "/event-notes", nil, &out)
	return out.Notes, err
}

// SaveEventNote teaches the site an event: creates its note, or updates the
// one a colleague already wrote.
func (c *Client) SaveEventNote(n evNote) (*evNote, error) {
	var out struct {
		Note evNote `json:"note"`
	}
	if err := c.do("POST", "/event-notes", n, &out); err != nil {
		return nil, err
	}
	return &out.Note, nil
}

// AtelierExport is what the Diag Atelier sends with « Envoyer au ticket »
// (diagAppExport() in the page): the report, the inventory sheet, the manual
// checks and the files it was built from (base64).
type AtelierExport struct {
	Report    json.RawMessage `json:"report"`
	Inventory json.RawMessage `json:"inventory"`
	State     json.RawMessage `json:"state"`
	Files     []AtelierFile   `json:"files"`
}

type AtelierFile struct {
	Source string `json:"source"`
	Name   string `json:"name"`
	B64    string `json:"b64"`
}

// Send posts the export as the Diag Atelier does (multipart, files gzipped),
// so the diagnostic reopens in the Diag Atelier on the site.
func (c *Client) Send(ticketID int, e AtelierExport) (*SendResult, error) {
	fields := map[string]string{}
	if ticketID > 0 {
		fields["ticket_id"] = strconv.Itoa(ticketID)
	}
	var res SendResult
	return &res, c.sendExport("/diagnostics", fields, e, &res)
}

// AuditTarget says which device of the audit the analysis is for (none: the
// site finds it by serial number or PC name, or creates it).
type AuditTarget struct {
	DeviceID   int    `json:"audit_device_id"`
	Kind       string `json:"kind"`
	Location   string `json:"location"`
	AssignedTo string `json:"assigned_to"`
	IP         string `json:"ip"`
	MAC        string `json:"mac"`
}

type AuditSendResult struct {
	ID            int              `json:"id"`
	Audit         map[string]any   `json:"audit"`
	AuditDevice   map[string]any   `json:"audit_device"`
	ReportURL     string           `json:"report_url"`
	AuditURL      string           `json:"audit_url"`
	Device        map[string]any   `json:"device"`
	DeviceCreated bool             `json:"device_created"`
	Filled        []string         `json:"filled"`
	Conflicts     []map[string]any `json:"conflicts"`
	Warnings      []string         `json:"warnings"`
}

// SendAudit posts the export of a PC's analysis on an audit of the site.
func (c *Client) SendAudit(auditID int, t AuditTarget, e AtelierExport) (*AuditSendResult, error) {
	if auditID <= 0 {
		return nil, errors.New("choisissez d'abord l'audit")
	}
	fields := map[string]string{"kind": t.Kind, "location": t.Location, "assigned_to": t.AssignedTo, "ip": t.IP, "mac": t.MAC}
	if t.DeviceID > 0 {
		fields["audit_device_id"] = strconv.Itoa(t.DeviceID)
	}
	var res AuditSendResult
	return &res, c.sendExport(fmt.Sprintf("/audits/%d/diagnostics", auditID), fields, e, &res)
}

// SendScan posts a network scan on an audit; with addDevices every host
// found becomes a device of the audit.
func (c *Client) SendScan(auditID int, r *netScanResult, addDevices bool) (json.RawMessage, error) {
	if auditID <= 0 || r == nil {
		return nil, errors.New("rien à envoyer : choisissez l'audit et lancez le scan")
	}
	body := map[string]any{
		"subnet": r.Subnet, "local_ip": r.LocalIP, "gateway": r.Gateway, "dns": r.DNS,
		"duration_ms": r.DurationMs, "hosts": r.Hosts, "add_devices": addDevices,
	}
	var out json.RawMessage
	return out, c.do("POST", fmt.Sprintf("/audits/%d/network-scans", auditID), body, &out)
}

func (c *Client) sendExport(path string, fields map[string]string, e AtelierExport, out any) error {
	if len(e.Report) == 0 || string(e.Report) == "null" {
		return errors.New("rapport vide : lancez d'abord une analyse")
	}
	raw := func(m json.RawMessage) string {
		if len(m) == 0 {
			return "null"
		}
		return string(m)
	}
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for k, v := range fields {
		if v != "" {
			_ = w.WriteField(k, v)
		}
	}
	_ = w.WriteField("report", raw(e.Report))
	_ = w.WriteField("inventory", raw(e.Inventory))
	_ = w.WriteField("state", raw(e.State))
	for _, f := range e.Files {
		data, err := base64.StdEncoding.DecodeString(f.B64)
		if err != nil {
			return fmt.Errorf("fichier %s illisible : %w", f.Name, err)
		}
		var gz bytes.Buffer
		zw := gzip.NewWriter(&gz)
		_, _ = zw.Write(data)
		_ = zw.Close()
		fw, err := w.CreateFormFile("files[]", f.Source+".gz")
		if err != nil {
			return err
		}
		_, _ = fw.Write(gz.Bytes())
		_ = w.WriteField("file_sources[]", f.Source)
		_ = w.WriteField("file_names[]", f.Name)
		_ = w.WriteField("file_encodings[]", "gzip")
	}
	if err := w.Close(); err != nil {
		return err
	}
	return c.request("POST", path, &buf, w.FormDataContentType(), out)
}

// Tickets and audits: the app reads and writes them through /tickets…,
// /todos and /audits… only.
func ticketPath(path string) error {
	if !strings.HasPrefix(path, "/tickets") && !strings.HasPrefix(path, "/todos") && !strings.HasPrefix(path, "/audits") {
		return fmt.Errorf("chemin refusé : %s", path)
	}
	if strings.Contains(path, "..") || strings.Contains(path, "://") {
		return fmt.Errorf("chemin refusé : %s", path)
	}
	return nil
}

// Call sends a JSON request to a ticket endpoint and returns the answer as is.
func (c *Client) Call(method, path string, body json.RawMessage) (json.RawMessage, error) {
	switch method {
	case "GET", "POST", "PATCH", "DELETE":
	default:
		return nil, fmt.Errorf("méthode refusée : %s", method)
	}
	if err := ticketPath(path); err != nil {
		return nil, err
	}
	var rd io.Reader
	ct := ""
	if len(body) > 0 && string(body) != "null" {
		rd, ct = bytes.NewReader(body), "application/json"
	}
	var out json.RawMessage
	return out, c.request(method, path, rd, ct, &out)
}

// UploadFile is a file picked in the interface, base64 encoded.
type UploadFile struct {
	Field string `json:"field"`
	Name  string `json:"name"`
	B64   string `json:"b64"`
}

// Upload posts form fields and files (chat attachments, ticket files) as multipart.
func (c *Client) Upload(path string, fields map[string]string, files []UploadFile) (json.RawMessage, error) {
	if err := ticketPath(path); err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for k, v := range fields {
		_ = w.WriteField(k, v)
	}
	for _, f := range files {
		data, err := base64.StdEncoding.DecodeString(f.B64)
		if err != nil {
			return nil, fmt.Errorf("fichier %s illisible : %w", f.Name, err)
		}
		fw, err := w.CreateFormFile(f.Field, f.Name)
		if err != nil {
			return nil, err
		}
		_, _ = fw.Write(data)
	}
	if err := w.Close(); err != nil {
		return nil, err
	}
	var out json.RawMessage
	return out, c.request("POST", path, &buf, w.FormDataContentType(), &out)
}

// Download fetches a ticket file and returns its name (from the site) and content.
func (c *Client) Download(path string) (string, []byte, error) {
	if err := ticketPath(path); err != nil {
		return "", nil, err
	}
	if c.Server == "" || c.Token == "" {
		return "", nil, errors.New("application non associée au site")
	}
	req, err := http.NewRequest("GET", c.Server+"/api/diag-app"+path, nil)
	if err != nil {
		return "", nil, err
	}
	c.headers(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return "", nil, fmt.Errorf("site injoignable : %w", err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 200<<20))
	if err != nil {
		return "", nil, err
	}
	if resp.StatusCode >= 300 {
		return "", nil, apiError(resp.StatusCode, data)
	}
	return downloadName(resp.Header.Get("Content-Disposition"), path), data, nil
}

func downloadName(disposition, path string) string {
	if _, params, err := mime.ParseMediaType(disposition); err == nil && params["filename"] != "" {
		return params["filename"]
	}
	parts := strings.Split(strings.Trim(path, "/"), "/")
	return parts[len(parts)-1]
}

func (c *Client) headers(req *http.Request) {
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "PC2Diag/"+Version)
	if c.Machine != "" {
		req.Header.Set("X-Diag-Machine", c.Machine)
	}
}

func (c *Client) do(method, path string, body any, out any) error {
	if body == nil {
		return c.request(method, path, nil, "", out)
	}
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	return c.request(method, path, bytes.NewReader(b), "application/json", out)
}

func (c *Client) request(method, path string, rd io.Reader, contentType string, out any) error {
	if c.Server == "" || c.Token == "" {
		return errors.New("application non associée au site")
	}
	req, err := http.NewRequest(method, c.Server+"/api/diag-app"+path, rd)
	if err != nil {
		return err
	}
	c.headers(req)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
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
	if status == 404 {
		// Laravel's own text here is English and technical
		return errors.New("introuvable sur le site (ticket ou fichier supprimé, ou adresse du site incorrecte)")
	}
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
	case 403:
		return errors.New("action refusée par le site")
	case 413:
		return errors.New("rapport trop volumineux pour le serveur")
	}
	return fmt.Errorf("erreur du site (HTTP %d)", status)
}
