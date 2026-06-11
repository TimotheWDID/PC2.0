<?php

return [
    'lists' => [
        [
            'key' => 'diagnostic_standard',
            'label' => 'Diagnostic standard',
            'tasks' => [
                'Verifier alimentation et demarrage',
                'Verifier etat disque et SMART',
                'Documenter la cause probable',
            ],
        ],
        [
            'key' => 'retour_client',
            'label' => 'Retour client',
            'tasks' => [
                'Valider les tests finaux',
                'Informer le client des actions realisees',
                'Confirmer la remise ou expedition',
            ],
        ],
    ],
];
