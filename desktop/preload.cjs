const { contextBridge, ipcRenderer } = require('electron');
const invoke = async (channel, ...args) => {
  const response = await ipcRenderer.invoke(channel, ...args);
  if (!response.ok) throw new Error(response.error);
  return response.data;
};
contextBridge.exposeInMainWorld('sasistant', Object.freeze({
  info: () => invoke('sa:info'),
  chooseFolder: () => invoke('sa:folder'),
  list: () => invoke('sa:list'),
  add: name => invoke('sa:add', name),
  login: id => invoke('sa:login', id),
  reconnect: id => invoke('sa:reconnect', id),
  sync: id => invoke('sa:sync', id),
  remove: id => invoke('sa:remove', id),
  send: (id, body) => invoke('sa:send', id, body),
}));
