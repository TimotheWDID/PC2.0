package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"syscall"
	"time"
)

// Connexion au site : un seul transport pour toute l'application, réglé pour
// les PC des clients (Wi-Fi faible, box lente, antivirus qui filtre le HTTPS,
// horloge fausse…), et des erreurs expliquées en français.

// siteTransport is shared by every Client.
//   - IdleConnTimeout court : les hébergeurs ferment une connexion inactive
//     au bout de quelques secondes ; la réutiliser au moment où le serveur la
//     ferme faisait échouer un envoi (« EOF », « connection reset »).
//   - CurvePreferences sans ML-KEM : depuis Go 1.24, le message d'ouverture
//     TLS dépasse un paquet, ce que certains antivirus, pare-feu et box
//     coupent net (délai dépassé, connexion réinitialisée).
var siteTransport = &http.Transport{
	Proxy: http.ProxyFromEnvironment,
	DialContext: (&net.Dialer{
		Timeout:   15 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext,
	ForceAttemptHTTP2:     true,
	MaxIdleConns:          10,
	IdleConnTimeout:       4 * time.Second,
	TLSHandshakeTimeout:   20 * time.Second,
	ExpectContinueTimeout: 1 * time.Second,
	TLSClientConfig: &tls.Config{
		MinVersion:       tls.VersionTLS12,
		CurvePreferences: []tls.CurveID{tls.X25519, tls.CurveP256, tls.CurveP384},
	},
}

var siteHTTP = &http.Client{Transport: siteTransport}

const (
	// défaut d'une requête JSON (liste de tickets, fiche, message…)
	siteTimeout = 60 * time.Second
	// débit montant prudent (ADSL de campagne, 4G faible) pour le délai d'un envoi
	uploadBytesPerSecond = 32 << 10
	maxUploadTimeout     = 30 * time.Minute
	downloadTimeout      = 15 * time.Minute
)

// requestTimeout leaves time for the body to go up on a slow line: 60 s, plus
// one second per 32 Ko sent.
func requestTimeout(base time.Duration, bodyLen int) time.Duration {
	d := base + time.Duration(bodyLen/uploadBytesPerSecond)*time.Second
	if d > maxUploadTimeout {
		d = maxUploadTimeout
	}
	return d
}

// NetError is a failure to reach the site (no HTTP answer): the network, not
// the site, is in question. Error() is for the technician; Cause keeps Go's
// error for the journal.
type NetError struct {
	Msg   string
	Cause error
}

func (e *NetError) Error() string {
	if e.Cause == nil {
		return e.Msg
	}
	return e.Msg + " (détail : " + shortCause(e.Cause) + ")"
}

func (e *NetError) Unwrap() error { return e.Cause }

// IsNetError says whether err is a failure to reach the site.
func IsNetError(err error) bool {
	var ne *NetError
	return errors.As(err, &ne)
}

// shortCause strips Go's « Get "https://…/api/diag-app/me": » prefix.
func shortCause(err error) string {
	var ue *url.Error
	if errors.As(err, &ue) {
		err = ue.Err
	}
	s := err.Error()
	if len(s) > 160 {
		s = s[:160] + "…"
	}
	return s
}

// now is time.Now, replaced in the tests.
var now = time.Now

// netError explains why the site could not be reached, from the most
// precise cause to the most general.
func netError(err error) error {
	if err == nil {
		return nil
	}
	msg := "site injoignable : vérifiez la connexion Internet du PC"
	var (
		dnsErr   *net.DNSError
		certErr  x509.CertificateInvalidError
		authErr  x509.UnknownAuthorityError
		hostErr  x509.HostnameError
		recErr   tls.RecordHeaderError
		opErr    *net.OpError
		errno    syscall.Errno
		timeoutE interface{ Timeout() bool }
	)
	low := strings.ToLower(err.Error())
	switch {
	case errors.As(err, &certErr) && certErr.Reason == x509.Expired:
		msg = "certificat du site refusé car hors de sa période de validité : l'horloge du PC est sans doute fausse (le PC indique le " +
			now().Format("02/01/2006 à 15h04") + "). Mettez Windows à l'heure (pile du BIOS ?) puis réessayez"
	case errors.As(err, &authErr) || strings.Contains(low, "certificate signed by unknown authority") || strings.Contains(low, "x509: certificate"):
		msg = "certificat du site non reconnu par ce PC : un antivirus ou un logiciel de contrôle parental filtre peut-être le HTTPS, " +
			"ou les certificats de Windows ne sont pas à jour. Vérifiez aussi la date du PC (" + now().Format("02/01/2006") + ")"
	case errors.As(err, &hostErr):
		msg = "le certificat ne correspond pas à l'adresse du site : un portail Wi-Fi (hôtel, gare) ou un filtrage intercepte la connexion"
	case errors.As(err, &recErr):
		msg = "le site ne répond pas en HTTPS à cette adresse : vérifiez l'adresse du site (port, http ou https)"
	case errors.As(err, &dnsErr):
		if dnsErr.IsNotFound {
			msg = "adresse du site introuvable : vérifiez qu'Internet fonctionne sur ce PC (DNS) et l'adresse du site"
		} else {
			msg = "le serveur DNS ne répond pas : la connexion Internet du PC est coupée ou instable"
		}
	case errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &timeoutE) && timeoutE.Timeout()):
		if errors.As(err, &opErr) && opErr.Op == "dial" {
			msg = "le site ne répond pas : connexion Internet coupée, ou pare-feu / antivirus qui bloque PC2 Diag"
		} else {
			msg = "le site met trop de temps à répondre : connexion lente ou coupée en cours de route. Réessayez"
		}
	case errors.As(err, &errno) && (errno == 10051 || errno == 10065 || errors.Is(err, syscall.ENETUNREACH) || errors.Is(err, syscall.EHOSTUNREACH)):
		// WSAENETUNREACH, WSAEHOSTUNREACH
		msg = "pas de réseau : le PC n'est pas connecté (câble, Wi-Fi ou mode avion)"
	case errors.As(err, &errno) && (errno == 10061 || errors.Is(err, syscall.ECONNREFUSED)):
		msg = "le serveur refuse la connexion : vérifiez l'adresse du site, ou le site est en maintenance"
	case errors.As(err, &errno) && (errno == 10054 || errno == 10053 || errors.Is(err, syscall.ECONNRESET)) ||
		strings.Contains(low, "connection reset") || strings.Contains(low, "forcibly closed") || errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF):
		msg = "connexion coupée pendant l'échange avec le site (réseau instable, ou antivirus / pare-feu qui l'interrompt). Réessayez"
	case strings.Contains(low, "proxyconnect"):
		msg = "le proxy configuré sur ce PC ne répond pas"
	}
	return &NetError{Msg: msg, Cause: err}
}

// retryable says whether a failed attempt can be made again without risk:
// a GET always, any other request only when it never reached the site
// (nom introuvable, connexion impossible), so nothing is created twice.
func retryable(method string, err error) bool {
	if errors.Is(err, context.DeadlineExceeded) {
		return false // le site est lent : le refaire doublerait l'attente
	}
	if method == http.MethodGet {
		return true
	}
	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		return true
	}
	var opErr *net.OpError
	return errors.As(err, &opErr) && opErr.Op == "dial"
}

// retryDelays are the pauses between attempts (variable for the tests).
var retryDelays = []time.Duration{1 * time.Second, 3 * time.Second}

// doRequest sends the request, again after a short pause when the network
// failed and it is safe; body is resent from the start each time. A busy
// server (502, 503, 504) is retried on a GET too.
func doRequest(build func(ctx context.Context) (*http.Request, error), timeout time.Duration) (*http.Response, context.CancelFunc, error) {
	var lastErr error
	for attempt := 0; ; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		req, err := build(ctx)
		if err != nil {
			cancel()
			return nil, nil, err
		}
		resp, err := siteHTTP.Do(req)
		if err == nil {
			busy := resp.StatusCode == 502 || resp.StatusCode == 503 || resp.StatusCode == 504
			if !busy || req.Method != http.MethodGet || attempt >= len(retryDelays) {
				return resp, cancel, nil
			}
			resp.Body.Close()
			lastErr = nil
		} else {
			lastErr = err
			if !retryable(req.Method, err) || attempt >= len(retryDelays) {
				cancel()
				return nil, nil, netError(lastErr)
			}
		}
		cancel()
		time.Sleep(retryDelays[attempt])
	}
}

// timeout is the client's own limit when set (events: 10 s), else def.
func (c *Client) timeout(def time.Duration) time.Duration {
	if c.Timeout > 0 {
		return c.Timeout
	}
	return def
}
