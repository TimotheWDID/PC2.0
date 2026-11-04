package main

import (
	"crypto/x509"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestNetErrorMessages(t *testing.T) {
	now = func() time.Time { return time.Date(2019, 1, 1, 10, 0, 0, 0, time.UTC) }
	defer func() { now = time.Now }()
	cases := []struct {
		err  error
		want string
	}{
		{&net.DNSError{Err: "no such host", Name: "x", IsNotFound: true}, "adresse du site introuvable"},
		{x509.CertificateInvalidError{Reason: x509.Expired}, "l'horloge du PC est sans doute fausse (le PC indique le 01/01/2019"},
		{x509.UnknownAuthorityError{}, "antivirus"},
		{&net.OpError{Op: "read", Err: errors.New("wsarecv: An existing connection was forcibly closed by the remote host.")}, "connexion coupée"},
	}
	for _, c := range cases {
		err := netError(c.err)
		if !IsNetError(err) || !strings.Contains(err.Error(), c.want) {
			t.Errorf("%v : %q, attendu %q", c.err, err, c.want)
		}
	}
}

func TestRequestTimeoutGrowsWithBody(t *testing.T) {
	if d := requestTimeout(siteTimeout, 0); d != siteTimeout {
		t.Errorf("sans corps : %s", d)
	}
	if d := requestTimeout(siteTimeout, 8<<20); d != siteTimeout+256*time.Second {
		t.Errorf("8 Mo : %s", d)
	}
	if d := requestTimeout(siteTimeout, 1<<30); d != maxUploadTimeout {
		t.Errorf("plafond : %s", d)
	}
}

func TestRetries(t *testing.T) {
	retryDelays = []time.Duration{time.Millisecond, time.Millisecond}
	defer func() { retryDelays = []time.Duration{time.Second, 3 * time.Second} }()

	// un GET sur un serveur surchargé (503) est refait, puis réussit
	var hits int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&hits, 1) < 3 && r.Method == "GET" {
			w.WriteHeader(503)
			return
		}
		if r.Method == "POST" {
			w.WriteHeader(503)
			return
		}
		_, _ = w.Write([]byte(`{"tickets":[{"id":4}]}`))
	}))
	defer srv.Close()
	c := NewClient(srv.URL, "k", "PC")
	if tk, err := c.Tickets(""); err != nil || len(tk) != 1 || atomic.LoadInt32(&hits) != 3 {
		t.Fatalf("GET refait : %v %v (%d essais)", tk, err, hits)
	}
	// un POST qui a atteint le site n'est jamais refait
	atomic.StoreInt32(&hits, 0)
	if _, err := c.Call("POST", "/tickets/4/messages", []byte(`{}`)); err == nil || atomic.LoadInt32(&hits) != 1 {
		t.Errorf("POST refait : %v (%d essais)", err, hits)
	}

	// site éteint : erreur réseau en français, POST refait car rien n'est parti
	ln, _ := net.Listen("tcp", "127.0.0.1:0")
	addr := ln.Addr().String()
	ln.Close()
	_, err := NewClient("http://"+addr, "k", "PC").Call("POST", "/tickets/4/messages", []byte(`{}`))
	if !IsNetError(err) || !strings.Contains(err.Error(), "refuse la connexion") {
		t.Errorf("site éteint : %v", err)
	}
	if !retryable("POST", &net.OpError{Op: "dial", Err: errors.New("x")}) || retryable("POST", &net.OpError{Op: "read", Err: errors.New("x")}) {
		t.Error("règle de nouvel essai du POST")
	}
}

func TestSlowSiteTimesOut(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(300 * time.Millisecond)
	}))
	defer srv.Close()
	c := NewClient(srv.URL, "k", "PC")
	c.Timeout = 50 * time.Millisecond
	start := time.Now()
	_, err := c.Me()
	if !IsNetError(err) || !strings.Contains(err.Error(), "trop de temps") || time.Since(start) > 250*time.Millisecond {
		t.Errorf("délai dépassé : %v en %s", err, time.Since(start))
	}
}
