export function render3DShowroom() {
 return `<section class="edm3d-showroom" id="edm3dShowroom" aria-labelledby="edm3dHeading">
 <div class="edm3d-heading"><div class="edm3d-eyebrow">EDM28 · COUPÉ SPORTIF GT3 RS · INTERPRÉTATION 3D</div>
 <h2 id="edm3dHeading">La mécanique, <em>sous tous les angles.</em></h2>
 <p>Explorez la voiture, retirez virtuellement une roue et découvrez les composants que nous entretenons.</p></div>
 <div class="edm3d-workspace">
  <div class="edm3d-stage">
   <div id="edm3dCanvas" class="edm3d-canvas"><div class="edm3d-loading">Chargement du modèle 3D…</div></div>
   <div class="edm3d-scene-top"><span class="edm3d-live-indicator">● VOITURE 3D</span><span>EDM28 · 360°</span></div>
   <div class="edm3d-stage-footer">
    <p id="edm3dWheelPrompt">Faites tourner la voiture, puis cliquez sur une roue pour la démonter virtuellement.</p>
    <div class="edm3d-controls">
     <button type="button" id="edm3dRotate" aria-pressed="false">Faire tourner la voiture</button>
     <button type="button" id="edm3dZoomIn" aria-label="Zoom avant">＋</button>
     <button type="button" id="edm3dZoomOut" aria-label="Zoom arrière">−</button>
     <button type="button" id="edm3dReset" disabled>Remonter la roue</button>
    </div>
   </div>
  </div>
  <aside class="edm3d-sidebar" aria-label="Explorer les composants mécaniques">
   <div class="edm3d-sidebar-step">01 — ROUE À EXPLORER</div>
   <label for="edm3dWheelChoice" class="edm3d-select-label">Choisissez une roue</label>
   <select id="edm3dWheelChoice"><option value="">Voiture complète</option><option value="av-gauche">Avant gauche</option><option value="av-droite">Avant droite</option><option value="ar-gauche">Arrière gauche</option><option value="ar-droite">Arrière droite</option></select>
   <div class="edm3d-wheel-shortcuts"><button type="button" data-edm-wheel="av-gauche">Avant G.</button><button type="button" data-edm-wheel="av-droite">Avant D.</button><button type="button" data-edm-wheel="ar-gauche">Arrière G.</button><button type="button" data-edm-wheel="ar-droite">Arrière D.</button></div>
   <div class="edm3d-sidebar-step">02 — COMPOSANT</div>
   <div id="edm3dParts" class="edm3d-parts"><p class="edm3d-empty">Sélectionnez une roue pour voir les pièces.</p></div>
   <div class="edm3d-info"><div class="edm3d-sidebar-step">03 — À QUOI SERT CETTE PIÈCE ?</div>
    <h3 id="edm3dPartTitle">Choisissez une roue</h3>
    <div id="edm3dPartBody"><p>Découvrez le rôle, les signes d'usure et les prestations disponibles.</p></div>
   </div>
  </aside>
 </div>
 <p class="edm3d-status" id="edm3dStatus" role="status" aria-live="polite">Préparation de la scène…</p>
 <div class="edm3d-note">Interprétation 3D stylisée du coupé blanc aux jantes rouges montré dans les photos de référence. Ce modèle pédagogique ne reproduit pas une CAO constructeur et ne suppose aucune affiliation avec Porsche. Aucun symptôme ne constitue un diagnostic et les pièces doivent être contrôlées sur le véhicule réel.</div>
 <div id="edm3dFallback" class="edm3d-fallback"><strong>Le showroom reste accessible sans 3D</strong><p>Retrouvez les fiches détaillées et les demandes d’intervention :</p><div><a href="/freinage/plaquettes-de-frein">Plaquettes de frein</a> · <a href="/freinage/disques-de-frein">Disques</a> · <a href="/liaison-au-sol">Liaison au sol</a> · <a href="/demande">Faire une demande</a></div></div>
 </section>`;
}
