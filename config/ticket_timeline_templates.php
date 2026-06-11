<?php

return [
    'templates' => [
        [
            'eventType' => 'manual_note',
            'label' => 'Note manuelle',
            'enabled' => true,
            'summary' => 'Point de suivi technique ajoute.',
            'details' => 'Diagnostic en cours. Prochain point prevu apres verification materielle.',
            'tasks' => [],
        ],
        [
            'eventType' => 'customer_call',
            'label' => 'Appel client',
            'enabled' => true,
            'summary' => 'Appel client effectue.',
            'details' => 'Client informe de l\'etat du ticket et des prochaines etapes.',
            'tasks' => [
                'Verifier les disponibilites client',
                'Confirmer la prochaine etape avec le client',
            ],
        ],
        [
            'eventType' => 'on_site_intervention',
            'label' => 'Intervention sur site',
            'enabled' => true,
            'summary' => 'Intervention sur site realisee.',
            'details' => 'Controle sur site effectue. Elements techniques verifies.',
            'tasks' => [
                'Verifier alimentation et connectique',
                'Executer les tests materiels de base',
            ],
        ],
        [
            'eventType' => 'diagnostic',
            'label' => 'Diagnostic',
            'enabled' => true,
            'summary' => 'Diagnostic technique termine.',
            'details' => 'Cause probable identifiee. Solution proposee au client.',
            'tasks' => [
                'Identifier la cause racine',
                'Documenter la solution proposee',
            ],
        ],
        [
            'eventType' => 'parts_ordered',
            'label' => 'Pieces commandees',
            'enabled' => true,
            'summary' => 'Pieces commandees.',
            'details' => 'Commande fournisseur lancee. Delai de reception estime a confirmer.',
            'tasks' => [
                'Saisir le numero de commande',
                'Confirmer le delai fournisseur',
            ],
        ],
        [
            'eventType' => 'parts_received',
            'label' => 'Pieces recues',
            'enabled' => true,
            'summary' => 'Pieces recues.',
            'details' => 'Pieces controlees a reception. Preparation du montage.',
            'tasks' => [
                'Controler la conformite des pieces',
                'Preparer l\'installation',
            ],
        ],
        [
            'eventType' => 'resolution_test',
            'label' => 'Test de resolution',
            'enabled' => true,
            'summary' => 'Tests de resolution effectues.',
            'details' => 'Tests fonctionnels realises. Resultats conformes.',
            'tasks' => [
                'Executer le protocole de validation',
                'Valider le resultat avec le client',
            ],
        ],
        [
            'eventType' => 'handover',
            'label' => 'Remise client',
            'enabled' => true,
            'summary' => 'Materiel remis au client.',
            'details' => 'Remise effectuee avec explications et recommandations d\'usage.',
            'tasks' => [
                'Verifier le fonctionnement final',
                'Expliquer les recommandations d\'usage',
            ],
        ],
        [
            'eventType' => 'other',
            'label' => 'Autre',
            'enabled' => false,
            'summary' => '',
            'details' => '',
            'tasks' => [],
        ],
        [
            'eventType' => 'commande_modification_prerequis',
            'label' => 'Modification commande (prerequis)',
            'enabled' => true,
            'summary' => 'Mise a jour commande demandee.',
            'details' => "Prerequis a verifier avant validation statut: fournisseur requis pour statut != new; numero de commande requis pour commande/reception/traite.",
            'tasks' => [
                'Verifier fournisseur renseigne',
                'Verifier numero de commande',
            ],
        ],
    ],
];
