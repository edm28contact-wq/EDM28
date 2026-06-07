export default async function handler(req, res) {
  const plate = String(req.query.plate || '').trim().toUpperCase();
  if (!plate) {
    return res.status(400).json({ success: false, error: 'Immatriculation manquante.' });
  }

  const token = process.env.PLATE_API_TOKEN || 'TokenDemo2026B';
  const country = process.env.PLATE_API_COUNTRY || 'FR';
  const url = `https://api.apiplaqueimmatriculation.com/plaque?immatriculation=${encodeURIComponent(plate)}&token=${encodeURIComponent(token)}&pays=${encodeURIComponent(country)}`;

  try {
    const response = await fetch(url, { method: 'POST' });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(200).json({ success: false, error: 'API plaque indisponible.', raw: data });
    }

    const source = data.data || data || {};
    const vehicle = {
      plate,
      make: source.marque || source.make || source.brand || '',
      model: source.modele || source.model || '',
      engine: source.motorisation || source.version || source.code_moteur || source.engine || '',
      year: source.annee || source.year || (source.date_premiere_circulation ? String(source.date_premiere_circulation).slice(0, 4) : ''),
      fuel: source.energie || source.fuel || '',
      vin: source.vin || source.VIN || '',
      cnit: source.cnit || source.type_mine || '',
      tecdocCarId: source.tecdoc_carid || source.tecdocCarId || '',
      oilNorm: source.oilNorm || '',
      oilCapacity: source.oilCapacity || ''
    };

    return res.status(200).json({ success: true, vehicle, raw: source });
  } catch (error) {
    return res.status(200).json({ success: false, error: 'Impossible de scanner la plaque pour le moment.' });
  }
}
