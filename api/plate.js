const v = data?.data || {};
const tech = v.caracteristiques_techniques_vehicule || {};
const immat = v.donnees_immatriculation_vehicule || {};

return res.status(200).json({
  success: true,
  vehicle: {
    plaque: immat.numero_immatriculation || cleanPlate,
    marque: tech.marque || "",
    modele: tech.denomination_commerciale || "",
    energie: tech.type_carburant?.label || tech.type_carburant?.code || "",
    motorisation: tech.cylindree ? `${tech.cylindree} cm3` : "",
    typeMine: tech.type_variante_version || "",
    categorie: tech.categorie_vehicule?.code || "",
    genre: tech.genre_national?.code || "",
    co2: tech.taux_co2 || "",
    normeEuro: tech.classe_environnementale?.code || "",
    datePremiereImmatriculation: immat.date_premiere_immatriculation || "",
    statutLocation: immat.statut_location?.label || ""
  }
});
