#!/usr/bin/env python3
"""
Script d'import de l'historique des salaires depuis Excel vers rh_salaires_mensuels
Import Jan-Oct 2025 pour 4 employés avec calculs automatiques des cotisations
"""

import os
from datetime import datetime
from decimal import Decimal
from supabase import create_client, Client
import openpyxl

# Configuration Supabase
# IMPORTANT: ne jamais committer une SERVICE_ROLE key dans le repo.
# Renseigner ces variables via l'environnement (ex: export SUPABASE_SERVICE_ROLE_KEY=...)
SUPABASE_URL = os.getenv(
    "SUPABASE_URL",
    "https://supabase.openpulse.example.org",
)
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_KEY:
    raise RuntimeError(
        "SUPABASE_SERVICE_ROLE_KEY manquante. "
        "Définissez-la dans votre environnement pour exécuter ce script."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Mapping des employés (nom dans profiles → données Excel)
EMPLOYEES = {
    'Durand': {
        'prenom': 'Camille',
        'poste': 'CTO',
        'salaires_nets_mensuels': [5280, 5280, 5280, 5280, 5280, 5280, 5280, 5280, 5280, 5280]  # Jan-Oct
    },
    'Durand': {
        'prenom': 'Camille',
        'poste': 'CSO',
        'salaires_nets_mensuels': [4993, 4993, 4993, 4993, 4993, 4993, 4993, 4993, 4993, 4993]  # Jan-Oct
    },
    'Bègne': {
        'prenom': 'Camille',
        'poste': 'Développeur',
        'salaires_nets_mensuels': [4500, 4500, 4500, 4500, 4500, 4500, 4500, 4500, 4500, 4500]  # Jan-Oct
    },
    'Durand': {
        'prenom': 'Camille',
        'poste': 'Business Development',
        'salaires_nets_mensuels': [3800, 3800, 3800, 3800, 3800, 3800, 3800, 3800, 3800, 3800]  # Jan-Oct
    }
}

MOIS_2025 = [
    '2025-01-01', '2025-02-01', '2025-03-01', '2025-04-01', '2025-05-01',
    '2025-06-01', '2025-07-01', '2025-08-01', '2025-09-01', '2025-10-01'
]


def calculate_charges(salaire_net: float) -> dict:
    """Calcule salaire brut et cotisations depuis le net"""
    salaire_brut = round(salaire_net / 0.78, 2)
    cotisations_salariales = round(salaire_brut * 0.22, 2)
    cotisations_patronales = round(salaire_brut * 0.45, 2)
    urssaf = round(salaire_brut * 0.45, 2)
    mutuelle = 60.0  # Fixe par employé
    prevoyance = round(salaire_brut * 0.015, 2)
    retraite = round(salaire_brut * 0.08, 2)
    
    return {
        'salaire_brut': salaire_brut,
        'salaire_net': salaire_net,
        'cotisations_salariales': cotisations_salariales,
        'cotisations_patronales': cotisations_patronales,
        'urssaf': urssaf,
        'mutuelle': mutuelle,
        'prevoyance': prevoyance,
        'retraite_complementaire': retraite
    }


def get_profile_id(nom: str, prenom: str) -> str:
    """Récupère l'ID du profile depuis Supabase"""
    response = supabase.table('profiles').select('id').eq('nom', nom).eq('prenom', prenom).single().execute()
    if response.data:
        return response.data['id']
    raise ValueError(f"Profile non trouvé pour {prenom} {nom}")


def import_salaires_historiques():
    """Import des salaires Jan-Oct 2025 pour tous les employés"""
    print("🚀 Début de l'import des salaires historiques (Jan-Oct 2025)\n")
    
    total_imported = 0
    total_errors = 0
    
    for nom, data in EMPLOYEES.items():
        prenom = data['prenom']
        print(f"📊 Traitement de {prenom} {nom} ({data['poste']})...")
        
        try:
            # Récupérer l'ID du profile
            profile_id = get_profile_id(nom, prenom)
            print(f"   ✅ Profile ID: {profile_id}")
            
            # Importer chaque mois
            for i, mois in enumerate(MOIS_2025):
                salaire_net = data['salaires_nets_mensuels'][i]
                charges = calculate_charges(salaire_net)
                
                # Insérer dans rh_salaires_mensuels
                salaire_data = {
                    'profile_id': profile_id,
                    'mois': mois,
                    'statut': 'paye',
                    'date_paiement': mois,
                    **charges
                }
                
                response = supabase.table('rh_salaires_mensuels').insert(salaire_data).execute()
                
                if response.data:
                    total_imported += 1
                    mois_str = datetime.strptime(mois, '%Y-%m-%d').strftime('%B %Y')
                    print(f"   ✅ {mois_str}: {salaire_net}€ net → {charges['salaire_brut']}€ brut")
                else:
                    total_errors += 1
                    print(f"   ❌ Erreur pour {mois}")
            
            print()
            
        except Exception as e:
            print(f"   ❌ Erreur: {str(e)}\n")
            total_errors += 1
    
    print(f"\n{'='*60}")
    print(f"✅ Import terminé:")
    print(f"   - {total_imported} enregistrements importés")
    print(f"   - {total_errors} erreurs")
    print(f"{'='*60}\n")


def verify_synchronization():
    """Vérifie que le trigger RH→Trésorerie a bien fonctionné"""
    print("🔍 Vérification de la synchronisation RH → Trésorerie\n")
    
    # Compter les salaires importés
    salaires_response = supabase.table('rh_salaires_mensuels').select('*', count='exact').execute()
    nb_salaires = salaires_response.count
    print(f"📊 Salaires dans rh_salaires_mensuels: {nb_salaires}")
    
    # Compter les dépenses créées automatiquement
    depenses_response = supabase.table('tresorerie_depenses').select('*', count='exact').eq('source', 'rh_salaires').execute()
    nb_depenses = depenses_response.count
    print(f"💰 Dépenses dans tresorerie_depenses (source=rh_salaires): {nb_depenses}")
    
    if nb_salaires == nb_depenses:
        print(f"\n✅ Synchronisation OK: {nb_salaires} salaires = {nb_depenses} dépenses")
    else:
        print(f"\n⚠️ ATTENTION: {nb_salaires} salaires ≠ {nb_depenses} dépenses")
        print("   Le trigger pourrait ne pas avoir fonctionné correctement.")
    
    # Vérifier les totaux par mois
    print("\n📈 Totaux par mois (Jan-Oct 2025):\n")
    
    for mois in MOIS_2025:
        # Total salaires nets RH
        salaires_mois = supabase.table('rh_salaires_mensuels').select('salaire_net').eq('mois', mois).execute()
        total_salaires = sum(s['salaire_net'] for s in salaires_mois.data) if salaires_mois.data else 0
        
        # Total dépenses trésorerie
        depenses_mois = supabase.table('tresorerie_depenses').select('montant').eq('source', 'rh_salaires').gte('date_prevue', mois).lt('date_prevue', f"{mois[:7]}-31").execute()
        total_depenses = sum(d['montant'] for d in depenses_mois.data) if depenses_mois.data else 0
        
        mois_str = datetime.strptime(mois, '%Y-%m-%d').strftime('%B %Y')
        status = "✅" if abs(total_salaires - total_depenses) < 1 else "⚠️"
        print(f"   {status} {mois_str}: RH={total_salaires:.2f}€ | Tréso={total_depenses:.2f}€")
    
    print()


def verify_totals():
    """Vérifie que les totaux correspondent à l'Excel"""
    print("🧮 Vérification des totaux vs Excel\n")
    
    # Totaux Excel attendus (Jan-Oct 2025)
    expected_totals = {
        'Durand': 5280 * 10,  # 52,800€
        'Bègne': 4500 * 10,     # 45,000€
        'Durand': 4993 * 10,     # 49,930€
        'Durand': 3800 * 10     # 38,000€
    }
    
    for nom, expected in expected_totals.items():
        # Récupérer le profile_id
        try:
            profile_id = get_profile_id(nom, EMPLOYEES[nom]['prenom'])
            
            # Calculer le total dans la BDD
            response = supabase.table('rh_salaires_mensuels').select('salaire_net').eq('profile_id', profile_id).gte('mois', '2025-01-01').lte('mois', '2025-10-01').execute()
            
            actual = sum(s['salaire_net'] for s in response.data) if response.data else 0
            diff = actual - expected
            status = "✅" if abs(diff) < 1 else "❌"
            
            print(f"   {status} {EMPLOYEES[nom]['prenom']} {nom}:")
            print(f"      Excel: {expected:.2f}€ | BDD: {actual:.2f}€ | Écart: {diff:.2f}€")
        
        except Exception as e:
            print(f"   ❌ {nom}: Erreur - {str(e)}")
    
    print()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("   IMPORT HISTORIQUE SALAIRES 2025 (Jan-Oct)")
    print("="*60 + "\n")
    
    # Étape 1: Import des salaires
    import_salaires_historiques()
    
    # Étape 2: Vérification synchronisation
    verify_synchronization()
    
    # Étape 3: Vérification totaux
    verify_totals()
    
    print("="*60)
    print("   ✅ SCRIPT TERMINÉ")
    print("="*60 + "\n")
