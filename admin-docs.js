(() => {
  window.EDMAdminDocs = {
    async load() {
      const app = window.EDMAdmin;
      app.$('docClient').onchange = () => this.loadVehicles();
      app.$('createDraftBtn').onclick = () => this.create();
      await this.list();
    },
    async loadVehicles() {
      const app = window.EDMAdmin;
      const id = app.$('docClient').value;
      if (!id) {
        app.$('docVehicle').innerHTML = '<option value="">Choisir</option>';
        return;
      }
      const { data, error } = await app.db.from('vehicles').select('id,plate,brand,model').eq('user_id', id);
      if (