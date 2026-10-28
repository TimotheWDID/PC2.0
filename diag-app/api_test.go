package main

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestTicketCalls(t *testing.T) {
	var got struct{ method, path, auth, ct, body string }
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		got.method, got.path, got.auth, got.ct, got.body = r.Method, r.URL.RequestURI(), r.Header.Get("Authorization"), r.Header.Get("Content-Type"), string(b)
		switch {
		case strings.HasSuffix(r.URL.Path, "/download"):
			w.Header().Set("Content-Disposition", `attachment; filename="facture.pdf"; filename*=UTF-8''facture%20%C3%A9t%C3%A9.pdf`)
			_, _ = w.Write([]byte("%PDF"))
		case strings.HasSuffix(r.URL.Path, "/assign-me"):
			w.WriteHeader(422)
			_, _ = w.Write([]byte(`{"message":"x","errors":{"assignee_id":["Ce ticket est deja attribue a un autre agent."]}}`))
		case strings.HasSuffix(r.URL.Path, "/tickets/9"):
			w.WriteHeader(404)
			_, _ = w.Write([]byte(`{"message":"No query results for model [App\\Models\\Ticket] 9"}`))
		default:
			_, _ = w.Write([]byte(`{"ok":true}`))
		}
	}))
	defer srv.Close()
	c := NewClient(srv.URL, "pc2d_k", "PC-TEST")

	out, err := c.Call("PATCH", "/tickets/5/status", json.RawMessage(`{"status":"in_progress"}`))
	if err != nil || string(out) != `{"ok":true}` {
		t.Fatalf("Call : %s, %v", out, err)
	}
	if got.method != "PATCH" || got.path != "/api/diag-app/tickets/5/status" || got.auth != "Bearer pc2d_k" || got.ct != "application/json" || got.body != `{"status":"in_progress"}` {
		t.Errorf("requête inattendue : %+v", got)
	}
	if _, err := c.Call("GET", "/todos", nil); err != nil || got.body != "" || got.ct != "" {
		t.Errorf("GET sans corps : %+v, %v", got, err)
	}
	if _, err := c.Call("POST", "/tickets/5/assign-me", nil); err == nil || err.Error() != "Ce ticket est deja attribue a un autre agent." {
		t.Errorf("erreur de validation : %v", err)
	}
	if _, err := c.Call("GET", "/tickets/9", nil); err == nil || !strings.HasPrefix(err.Error(), "introuvable sur le site") {
		t.Errorf("404 : %v", err)
	}
	for _, bad := range [][2]string{{"GET", "/me"}, {"GET", "/tickets/../me"}, {"PUT", "/tickets/5"}, {"GET", "/diagnostics"}} {
		if _, err := c.Call(bad[0], bad[1], nil); err == nil {
			t.Errorf("%s %s aurait dû être refusé", bad[0], bad[1])
		}
	}

	_, err = c.Upload("/tickets/5/messages", map[string]string{"content": "Bonjour", "is_internal": "1"},
		[]UploadFile{{Field: "attachments[]", Name: "photo.png", B64: base64.StdEncoding.EncodeToString([]byte("PNG"))}})
	if err != nil || !strings.HasPrefix(got.ct, "multipart/form-data") || !strings.Contains(got.body, `name="attachments[]"; filename="photo.png"`) || !strings.Contains(got.body, "Bonjour") {
		t.Errorf("envoi multipart : %v, %+v", err, got)
	}

	name, data, err := c.Download("/tickets/5/files/3/download")
	if err != nil || name != "facture été.pdf" || string(data) != "%PDF" {
		t.Errorf("téléchargement : %q %q %v", name, data, err)
	}
}

func TestDownloadName(t *testing.T) {
	if n := downloadName(`inline; filename="Fiche client.html"`, "/tickets/1/diagnostics/2/client-report"); n != "Fiche client.html" {
		t.Errorf("nom : %q", n)
	}
	if n := downloadName("", "/tickets/1/diagnostics/2/client-report"); n != "client-report" {
		t.Errorf("nom par défaut : %q", n)
	}
}

func TestAuditCalls(t *testing.T) {
	var got struct{ path, ct, body string }
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		got.path, got.ct, got.body = r.URL.Path, r.Header.Get("Content-Type"), string(b)
		w.WriteHeader(201)
		_, _ = w.Write([]byte(`{"id":7,"audit":{"id":3},"audit_device":{"id":12,"name":"PC-ACCUEIL"},"device_created":true}`))
	}))
	defer srv.Close()
	c := NewClient(srv.URL, "pc2d_k", "PC-ACCUEIL")

	exp := AtelierExport{Report: json.RawMessage(`{"machine":{"name":"PC"}}`), Files: []AtelierFile{{Source: "app", Name: "Analyse.json", B64: base64.StdEncoding.EncodeToString([]byte("{}"))}}}
	res, err := c.SendAudit(3, AuditTarget{Location: "Accueil"}, exp)
	if err != nil || res.ID != 7 || !res.DeviceCreated || got.path != "/api/diag-app/audits/3/diagnostics" {
		t.Fatalf("envoi à l'audit : %+v, %v, %s", res, err, got.path)
	}
	if !strings.Contains(got.body, `name="location"`) || strings.Contains(got.body, `name="audit_device_id"`) || strings.Contains(got.body, `name="assigned_to"`) {
		t.Errorf("champs envoyés : %s", got.body)
	}
	if _, err := c.SendAudit(0, AuditTarget{}, exp); err == nil {
		t.Error("audit manquant accepté")
	}

	scan := &netScanResult{Subnet: "192.168.1.0/24", Hosts: []netHost{{IP: "192.168.1.1", Gateway: true, Kind: "router"}}}
	if _, err := c.SendScan(3, scan, true); err != nil || got.path != "/api/diag-app/audits/3/network-scans" || got.ct != "application/json" {
		t.Fatalf("envoi du scan : %v, %+v", err, got)
	}
	var body map[string]any
	_ = json.Unmarshal([]byte(got.body), &body)
	if body["add_devices"] != true || len(body["hosts"].([]any)) != 1 {
		t.Errorf("scan envoyé : %s", got.body)
	}
	if _, err := c.Call("GET", "/audits?q=martin", nil); err != nil {
		t.Errorf("liste des audits refusée : %v", err)
	}
}
