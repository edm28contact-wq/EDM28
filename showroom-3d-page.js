export function render3DShowroom() {
 return `<section class="edm3d-showroom" id="edm3dShowroom" data-view="reference" aria-labelledby="edm3dHeading">
 <div class="edm3d-heading"><div class="edm3d-eyebrow">EDM28 · PORSCHE 911 GT3 RS · SHOWROOM 3D INDÉPENDANT</div>
 <h2 id="edm3dHeading">La mécanique, <em>sous tous les angles.</em></h2>
 <p>Faites tourner la GT3 RS, sélectionnez une roue et explorez directement les pièces disponibles dans le modèle, avec leurs explications techniques.</p></div>
 <div class="edm3d-workspace">
  <div class="edm3d-stage">
   <div class="edm3d-scene-title">GT3 RS · EXPLORATION INTERACTIVE</div>
   <div id="edm3dReference" class="edm3d-reference">
    <div id="edm3dReferenceIntro" class="edm3d-reference-intro">
     <span class="edm3d-reference-kicker">PORSCHE 911 GT3 RS · 992</span>
     <h3>Une silhouette réelle.<br>Une exploration à 360°.</h3>
     <p>Le modèle réaliste se charge après votre clic. Vous pourrez faire tourner la GT3 RS et démonter uniquement les pièces identifiées comme indépendantes dans son fichier 3D. Le service Sketchfab reçoit votre connexion après votre accord.</p>
     <button id="edm3dLoadReference" type="button">Afficher la GT3 RS en 3D</button>
     <p id="edm3dReferenceLoadStatus" role="status">Après le chargement, choisissez une roue et utilisez les commandes de démontage à droite.</p>
    </div>
    <iframe id="edm3dReferenceFrame" title="Modèle 3D externe de Porsche 911 GT3 RS, rotation interactive fournie par Sketchfab" data-src="https://sketchfab.com/models/5fd62615f72a4012a5ebc15cd4c64461/embed?autostart=1&amp;ui_hint=2&amp;ui_theme=dark" loading="lazy" allow="autoplay; fullscreen; xr-spatial-tracking" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
    <div class="edm3d-reference-credit">Modèle indépendant par <a href="https://sketchfab.com/3d-models/porsche-911-gt3-rs-semester-2-5fd62615f72a4012a5ebc15cd4c64461" target="_blank" rel="noopener noreferrer">jasonUWU / Sketchfab</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Pas d'affiliation avec Porsche.</div>
   </div>
   <div id="edm3dCanvas" class="edm3d-canvas"><div class="edm3d-loading">Chargement du modèle 3D…</div></div>
   <div class="edm3d-scene-top"><span class="edm3d-live-indicator">● VOITURE 3D</span><span>EDM28 · 360°</span></div>
   <div class="edm3d-stage-footer">
    <p id="edm3dWheelPrompt">Atelier HD : faites tourner l’assemblage, puis sélectionnez une roue pour explorer les pièces.</p>
    <div class="edm3d-controls">
     <button type="button" id="edm3dRotate" aria-pressed="false">Faire tourner la voiture</button>
     <button type="button" id="edm3dZoomIn" aria-label="Zoom avant">＋</button>
     <button type="button" id="edm3dZoomOut" aria-label="Zoom arrière">−</button>
     <button type="button" id="edm3dReset" disabled>Remonter la roue</button>
    </div>
   </div>
  </div>
  <aside class="edm3d-sidebar" aria-label="Explorer les composants mécaniques">
   <div class="edm3d-sidebar-step">01 — ROUE DE LA GT3 RS</div>
   <p id="edm3dModelSupport" class="edm3d-model-support" role="status" aria-live="polite">Chargez la GT3 RS pour détecter ses pièces démontables.</p>
   <label for="edm3dWheelChoice" class="edm3d-select-label">Choisissez une roue</label>
   <select id="edm3dWheelChoice"><option value="">Voiture complète</option><option value="av-gauche">Avant gauche</option><option value="av-droite">Avant droite</option><option value="ar-gauche">Arrière gauche</option><option value="ar-droite">Arrière droite</option></select>
   <div class="edm3d-wheel-shortcuts"><button type="button" data-edm-wheel="av-gauche">Avant G.</button><button type="button" data-edm-wheel="av-droite">Avant D.</button><button type="button" data-edm-wheel="ar-gauche">Arrière G.</button><button type="button" data-edm-wheel="ar-droite">Arrière D.</button></div>
   <div class="edm3d-pick-panel" id="edm3dPickPanel">
    <div class="edm3d-sidebar-step">02 — IDENTIFIER UNE PIÈCE SUR LA GT3 RS</div>
    <label for="edm3dPickPart" class="edm3d-select-label">Pièce à sélectionner</label>
    <select id="edm3dPickPart">
     <option value="roue">Roue et jante</option>
     <option value="etrier">Étrier de frein</option>
     <option value="plaquettes">Plaquettes de frein</option>
     <option value="disques">Disque de frein</option>
     <option value="moyeu">Moyeu</option>
     <option value="triangles">Triangle de suspension</option>
     <option value="rotules">Rotule de direction</option>
     <option value="stabilisation">Biellette stabilisatrice</option>
     <option value="amortisseur">Amortisseur</option>
    </select>
    <button id="edm3dPickStart" type="button">Identifier dans la GT3 RS</button>
    <button id="edm3dPickRemove" type="button" disabled>Masquer la pièce identifiée</button>
    <button id="edm3dPickRestore" type="button">Réafficher les pièces</button>
    <p id="edm3dPickHint" role="status">Choisissez une roue, puis cliquez sur « Identifier ». Touchez ensuite la pièce correspondante dans le modèle 3D.</p>
    <div id="edm3dPickConfirm" hidden>
     <p id="edm3dPickCandidate"></p>
     <button id="edm3dPickAccept" type="button">Confirmer cette pièce</button>
     <button id="edm3dPickCancel" type="button">Annuler</button>
    </div>
   </div>
   <div class="edm3d-inspection" id="edm3dInspection" hidden>
    <div class="edm3d-sidebar-step">03 — DÉMONTAGE SUR LA VOITURE</div>
    <div class="edm3d-family-switch" role="group" aria-label="Famille de composants">
     <button type="button" id="edm3dFamilyFreinage" aria-pressed="true">Freinage</button>
     <button type="button" id="edm3dFamilyLiaison" aria-pressed="false">Liaison au sol</button>
    </div>
    <div class="edm3d-step-panel" aria-label="Démontage virtuel">
     <strong id="edm3dStepLabel">Assemblage complet</strong>
     <div class="edm3d-progress-track" aria-hidden="true"><span id="edm3dStepProgress"></span></div>
     <p id="edm3dStepDescription" aria-live="polite">Sélectionnez une roue.</p>
     <div class="edm3d-step-actions">
      <button type="button" id="edm3dPrevStep" disabled>Pièce précédente</button>
      <button type="button" id="edm3dNextStep">Démonter la pièce suivante</button>
     </div>
     <button type="button" id="edm3dRebuild">Remonter toutes les pièces</button>
    </div>
   </div>
   <div class="edm3d-sidebar-step">04 — COMPOSANTS À EXPLORER</div>
   <div id="edm3dParts" class="edm3d-parts"><p class="edm3d-empty">Sélectionnez une roue pour voir les pièces.</p></div>
   <div class="edm3d-info"><div class="edm3d-sidebar-step">05 — À QUOI SERT CETTE PIÈCE ?</div>
    <h3 id="edm3dPartTitle">Choisissez une roue</h3>
    <div id="edm3dPartBody"><p>Découvrez le rôle, les signes d'usure et les prestations disponibles.</p></div>
   </div>
  </aside>
 </div>
 <p class="edm3d-status" id="edm3dStatus" role="status" aria-live="polite">Préparation de la scène…</p>
 <div class="edm3d-note">Un seul modèle de GT3 RS est utilisé pour l’exploration. Seuls les éléments distincts et identifiables de ce modèle peuvent être masqués. Les pièces non séparées restent visibles ; aucune disparition n’est simulée. Modèle indépendant sous CC BY 4.0 hébergé par Sketchfab, sans affiliation Porsche. Informations pédagogiques et non diagnostiques.</div>
 <div id="edm3dFallback" class="edm3d-fallback"><strong>Le showroom reste accessible sans 3D</strong><p>Retrouvez les fiches détaillées et les demandes d’intervention :</p><div><a href="/freinage/plaquettes-de-frein">Plaquettes de frein</a> · <a href="/freinage/disques-de-frein">Disques</a> · <a href="/liaison-au-sol">Liaison au sol</a> · <a href="/demande">Faire une demande</a></div></div>
 </section>`;
}
