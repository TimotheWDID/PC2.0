import { Head, Link } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

/**
 * ========================================
 * FONCTIONS UTILITAIRES DE TRADUCTION
 * ========================================
 * Ces fonctions convertissent les valeurs ang. en abbréviation fr.
 */

// Convertit la priorité en abréviation: low→B, medium→M, high→H
const translatePriority = (priority: string | null): string => {
  if (!priority) return '';
  const map: Record<string, string> = {
    low: 'Basse',       // Bas
    medium: 'Moyenne',    // Moyen
    high: 'Haute',      // Haut
  };
  return map[priority] || priority;
};

// Convertit le statut en abréviation: open→Ouv, in_progress→Enc, etc.
const translateStatus = (status: string | null): string => {
  if (!status) return '';
  const map: Record<string, string> = {
    open: 'Ouv',        // Ouvert
    in_progress: 'Enc', // Encours
    pending: 'Att',     // Attente
    resolved: 'Res',    // Résolu
    closed: 'Fer',      // Fermé
  };
  return map[status] || status;
};

/**
 * ========================================
 * TYPES ET INTERFACES
 * ========================================
 */

// Type du ticket reçu du backend
type TicketLabel = {
  id: number;                  // Numéro du ticket
  title: string | null;        // Titre/Sujet du ticket
  message: string | null;      // Message/Description du ticket
  created_at: string | null;   // Date/heure de création (format: "d/m/Y H:i")
  priority: string | null;     // Priorité: low, medium, high
  status: string | null;       // Statut: open, in_progress, pending, resolved, closed
  user?: {                      // Infos du client
    name: string;              // Nom du client
    email?: string;            // Email du client
    phone?: string;            // Téléphone du client
    address?: string;          // Adresse du client
  } | null;
  category?: { name: string } | null;  // Catégorie du ticket
  qr_payload: string | null;   // URL à encoder dans le QR code
};

/**
 * ========================================
 * COMPOSANT PRINCIPAL
 * ========================================
 * Génère une étiquette imprimable avec toutes les infos du ticket
 */
type LabelSettings = {
  widthMm: number;
  heightMm: number;
  qrSizeMm: number;
  marginMm: number;
  layout: 'qr-right' | 'qr-left';
  showId: boolean;
  showClient: boolean;
  showTitle: boolean;
  showMessage: boolean;
  showCategory: boolean;
  showPriority: boolean;
  showStatus: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showDate: boolean;
  showTime: boolean;
  showQr: boolean;
};

const defaultLabelSettings: LabelSettings = {
  widthMm: 29,
  heightMm: 62,
  qrSizeMm: 18,
  marginMm: 1,
  layout: 'qr-right',
  showId: true,
  showClient: true,
  showTitle: true,
  showMessage: false,
  showCategory: true,
  showPriority: true,
  showStatus: false,
  showEmail: true,
  showPhone: true,
  showAddress: false,
  showDate: true,
  showTime: true,
  showQr: true,
};

export default function PrintLabel({
  ticket,
  labelSettings: labelSettingsProp,
}: {
  ticket: TicketLabel;
  labelSettings?: Partial<LabelSettings>;
}) {
  // ==========================================
  // ÉTATS (useState)
  // Pour stocker les données qui changent
  // ==========================================

  // Image du QR code en base64 (générée depuis qr_payload)
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Nom de l'imprimante stocké localement (pas essentiel, juste affichage)
  const [printerName, setPrinterName] = useState('');

  // Tous les paramètres d'affichage de l'étiquette: tailles, visibilité des champs, layout
  // À MODIFIER: Ces valeurs par défaut s'appliquent avant le chargement depuis localStorage
  const labelSettings = useMemo(() => {
    return {
      ...defaultLabelSettings,
      ...(labelSettingsProp ?? {}),
    };
  }, [labelSettingsProp]);


  // ==========================================
  // DONNÉES CALCULÉES (useMemo)
  // Extraire et formater les données à afficher
  // ==========================================

  // Titre du ticket (ou "Ticket" par défaut)
  const labelTitle = useMemo(() => ticket.title ?? 'Ticket', [ticket.title]);

  const layoutScale = useMemo(() => {
    const base = Math.min(labelSettings.widthMm, labelSettings.heightMm) / 29;
    return Math.max(0.7, Math.min(1.2, base));
  }, [labelSettings.widthMm, labelSettings.heightMm]);

  const fontBoost = 1.18;

  const titleFontPt = useMemo(() => {
    const base = 7 * layoutScale * fontBoost;
    if (labelTitle.length > 60) return Math.max(5 * layoutScale * fontBoost, base - 2 * layoutScale * fontBoost);
    if (labelTitle.length > 40) return Math.max(5.5 * layoutScale * fontBoost, base - 1.5 * layoutScale * fontBoost);
    return base;
  }, [labelTitle.length, layoutScale]);

  const innerPaddingMm = useMemo(() => {
    const base = Math.min(labelSettings.widthMm, labelSettings.heightMm) * 0.02;
    return Math.max(0, Math.min(1, base));
  }, [labelSettings.widthMm, labelSettings.heightMm]);

  const innerGapMm = useMemo(() => {
    const base = Math.min(labelSettings.widthMm, labelSettings.heightMm) * 0.015;
    return Math.max(0, Math.min(0.6, base));
  }, [labelSettings.widthMm, labelSettings.heightMm]);

  const contentWidthMm = useMemo(() => {
    return Math.max(1, labelSettings.widthMm - (labelSettings.marginMm * 2));
  }, [labelSettings.widthMm, labelSettings.marginMm]);

  const contentHeightMm = useMemo(() => {
    return Math.max(1, labelSettings.heightMm - (labelSettings.marginMm * 2));
  }, [labelSettings.heightMm, labelSettings.marginMm]);

  // Nom du client (ou "Client" par défaut)
  const customerName = useMemo(() => ticket.user?.name ?? 'Client', [ticket.user?.name]);

  // Email du client (vide si absent)
  const customerEmail = useMemo(() => ticket.user?.email ?? '', [ticket.user?.email]);

  // Téléphone du client (vide si absent)
  const customerPhone = useMemo(() => ticket.user?.phone ?? '', [ticket.user?.phone]);

  // Adresse du client (vide si absent)
  const customerAddress = useMemo(() => ticket.user?.address ?? '', [ticket.user?.address]);

  // Catégorie du ticket (vide si absent)
  const categoryName = useMemo(() => ticket.category?.name ?? '', [ticket.category?.name]);

  // Premier 100 caractères du message (pour ne pas faire trop grand)
  // À MODIFIER: Changer 100 pour un autre nombre si tu veux plus/moins de texte
  const ticketMessage = useMemo(() => {
    const msg = ticket.message ?? '';
    return msg.substring(0, 100);  // 100 = limite de caractères
  }, [ticket.message]);

  // Date d'création extraite (avant l'espace): "12/02/2026"
  // Format reçu du backend: "12/02/2026 14:30" → on récupère la première partie
  const createdAtDate = useMemo(() => {
    if (!ticket.created_at) return '';
    const parts = ticket.created_at.split(' ');
    return parts[0] ?? '';
  }, [ticket.created_at]);

  // Heure de création extraite (après l'espace): "14:30"
  const createdAtTime = useMemo(() => {
    if (!ticket.created_at) return '';
    const parts = ticket.created_at.split(' ');
    return parts[1] ?? '';
  }, [ticket.created_at]);

  // ==========================================
  // EFFETS (useEffect)
  // S'exécutent au rendu ou lors de changements
  // ==========================================

  // 1. Générer le QR code depuis la payload URL
  // Le QR code est créé en base64 et stocké dans qrDataUrl
  // À MODIFIER: Changer "width: 120" pour agrandir/réduire la résolution du QR
  useEffect(() => {
    if (!ticket.qr_payload) return;
    QRCode.toDataURL(ticket.qr_payload, { width: 120, margin: 0 })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [ticket.qr_payload]);

  // 2. Charger le nom de l'imprimante depuis localStorage
  // Juste un label de référence affichée en haut
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('ticketPrinterName');
    if (stored) setPrinterName(stored);
  }, []);

  // 3. Lancer l'impression automatiquement après 200ms
  // À MODIFIER: Changer 200 si tu veux une autre délai avant impression
  // Mettre "return" au lieu de setLabelSettings si tu veux désactiver l'auto-print
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = window.setTimeout(() => window.print(), 200);  // 200ms = délai d'attente
    return () => window.clearTimeout(timer);
  }, []);

  // ==========================================
  // RENDU JSX
  // ==========================================

  return (
    <div className="page-root min-h-screen bg-slate-100 p-6 print:bg-white print:p-0">
      <Head title={`Impression ticket #${ticket.id}`} />

      {/* ===== STYLE CSS @media print ===== */}
      {/* À MODIFIER: Modifier les tailles mm et margins ici pour changer le format de page */}
      <style>{`
        @page {
          size: ${labelSettings.widthMm}mm ${labelSettings.heightMm}mm;  /* Taille de la page à l'impression */
          margin: ${labelSettings.marginMm}mm;  /* Marge d'impression */
        }
        .label-frame {
          position: relative;
          overflow: hidden;
        }
        .preview-rotate {
          transform: rotate(-90deg);
          transform-origin: center;
        }
        .label-margin {
          position: absolute;
          inset: 0;
          background: #f3f4f6;
        }
        .label-content {
          position: absolute;
          top: ${labelSettings.marginMm}mm;
          left: ${labelSettings.marginMm}mm;
          overflow: hidden;
        }
        .label-content, .label-content * {
          color: #000;
        }
        .label-rotated {
          position: absolute;
          top: 0;
          left: 0;
          transform: rotate(90deg) translateY(-100%);
          transform-origin: top left;
        }
        @media print {
          html, body {
            margin: 0;
            padding: 0;
            width: ${labelSettings.widthMm}mm;
            height: ${labelSettings.heightMm}mm;
          }
          .page-root {
            width: ${labelSettings.widthMm}mm;
            height: ${labelSettings.heightMm}mm;
            min-height: 0;
            padding: 0 !important;
          }
          .label-frame {
            box-shadow: none;
            border: none;
            page-break-inside: avoid;
          }
          .preview-rotate {
            transform: none;
          }
          .label-frame, .label-frame * {
            color: #000 !important;
          }
          .label-margin {
            background: #fff !important;
          }
          .print-hide { display: none !important; }  /* Masquer les boutons à l'impression */
        }
      `}</style>

      {/* ===== BARRE DE CONTRÔLE (visible à l'écran mais pas à l'impression) ===== */}
      <div className="print-hide mb-4 flex items-center gap-2">
        <Link href={`/tickets/${ticket.id}`} className="text-sm text-muted-foreground">
          Retour au ticket
        </Link>
        <span className="text-sm text-muted-foreground">|</span>
        <Link href="/tickets/print-settings" className="text-sm text-muted-foreground">
          Parametres imprimante
        </Link>
        <span className="text-sm text-muted-foreground">|</span>

        {/* Lien vers les options d'étiquette (où changer les champs visibles) */}
        <Link href="/settings/ticket-label" className="text-sm text-muted-foreground">
          Options etiquette
        </Link>

        {/* Affichage du nom de l'imprimante pour référence */}
        {printerName && (
          <span className="text-sm text-muted-foreground">Imprimante: {printerName}</span>
        )}

        {/* Bouton d'impression manuel */}
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto text-sm rounded-md border px-3 py-1 bg-white hover:bg-slate-50"
        >
          Imprimer
        </button>
      </div>

      {/* ===== CADRE DE L'ÉTIQUETTE ===== */}
      {/* À MODIFIER: Les dimensions ici sont contrôlées par labelSettings depuis localStorage */}
      {/* La largeur/hauteur en mm correspondent à votre étiquette physique */}
      <div
        className="label-frame preview-rotate mx-auto bg-white border shadow-sm"
        style={{ width: `${labelSettings.widthMm}mm`, height: `${labelSettings.heightMm}mm` }}
      >
        <div className="label-margin" />
        <div
          className="label-content"
          style={{ width: `${contentWidthMm}mm`, height: `${contentHeightMm}mm` }}
        >
          {/* Conteneur rotatif: l'ecriture pivote pour suivre la largeur du rouleau */}
          <div
            className="label-rotated"
            style={{ width: `${contentHeightMm}mm`, height: `${contentWidthMm}mm` }}
          >
            {/* Conteneur principal de l'étiquette - À MODIFIER: padding=2px pour l'espacement interne */}
            <div
              className={`h-full w-full flex ${
                labelSettings.layout === 'qr-left' ? 'flex-row-reverse' : 'flex-row'
                // Si layout='qr-left', le QR est à gauche (flex-row-reverse inverse l'ordre)
                // Si layout='qr-right' (défaut), le QR est à droite
              }`}
              style={{ padding: `${innerPaddingMm}mm`, gap: `${innerGapMm}mm` }}
            >
              {/* ===== ZONE TEXTE (gauche ou droite selon layout) ===== */}
              <div
                className="flex-1 flex flex-col justify-between min-w-0 leading-none"
                style={{ gap: `${innerGapMm}mm` }}
              >

                {/* --- SECTION HAUT: ID + TITRE --- */}
                <div style={{ minHeight: `${8 * layoutScale}px` }}>
                  {/* Numéro du ticket + Priorité côte à côte - À MODIFIER: 9pt = taille police */}
                  {labelSettings.showId && (
                    <div
                      className="font-semibold flex items-center"
                      style={{ fontSize: `${9 * layoutScale * fontBoost}pt`, lineHeight: '1', gap: `${2 * layoutScale}px` }}
                    >
                      <span>Ticket#{ticket.id}</span>
                      {labelSettings.showPriority && ticket.priority && (
                        <span className="text-slate-700">({translatePriority(ticket.priority)})</span>
                      )}
                    </div>
                  )}

                  {/* Titre du ticket */}
                  {labelSettings.showTitle && (
                    <div
                      className="text-slate-700"
                      style={{ fontSize: `${titleFontPt}pt`, lineHeight: '1.1', wordBreak: 'break-word' }}
                    >
                      {labelTitle}
                    </div>
                  )}
                </div>

                {/* --- SECTION MILIEU: DÉTAILS COMPACTÉS --- */}
                {/* À MODIFIER: Ajouter/retirer des lignes ici pour afficher d'autres infos - 6pt = taille police des détails */}
                <div style={{ fontSize: `${6 * layoutScale * fontBoost}pt`, lineHeight: '1.1' }}>

                  {/* Nom du client */}
                  {labelSettings.showClient && (
                    <div className="truncate">{customerName}</div>
                  )}

                  {/* Catégorie */}
                  {labelSettings.showCategory && categoryName && (
                    <div className="truncate">Cat: {categoryName}</div>
                  )}

                  {/* Statut */}
                  {labelSettings.showStatus && ticket.status && (
                    <div>Stat: {translateStatus(ticket.status)}</div>
                  )}

                  {/* Email du client */}
                  {labelSettings.showEmail && customerEmail && (
                    <div className="truncate">{customerEmail}</div>
                  )}

                  {/* Téléphone du client */}
                  {labelSettings.showPhone && customerPhone && (
                    <div className="truncate">{customerPhone}</div>
                  )}

                  {/* Adresse du client */}
                  {labelSettings.showAddress && customerAddress && (
                    <div className="truncate">{customerAddress}</div>
                  )}

                  {/* Date et heure sur la même ligne */}
                  {labelSettings.showDate && (
                    <div>
                      {createdAtDate}
                      {/* Heure ajoutée après la date */}
                      {labelSettings.showTime && createdAtTime && (
                        <span> {createdAtTime}</span>
                      )}
                    </div>
                  )}

                  {/* Extrait du message (dernière ligne) */}
                  {labelSettings.showMessage && ticketMessage && (
                    <div className="italic text-slate-600" style={{ wordBreak: 'break-word' }}>
                      {ticketMessage}
                    </div>
                  )}
                </div>
              </div>

              {/* ===== QR CODE (droite ou gauche selon layout) ===== */}
              {/* À MODIFIER: La taille du QR est contrôlée par labelSettings.qrSizeMm */}
              {labelSettings.showQr && qrDataUrl && (
                <div
                  className="flex items-center justify-center flex-shrink-0 bg-white"
                  style={{
                    width: `${labelSettings.qrSizeMm}mm`,
                    height: `${labelSettings.qrSizeMm}mm`,
                    border: '0.5px solid #ccc',
                  }}
                >
                  <img src={qrDataUrl} alt="QR" className="w-full h-full" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
