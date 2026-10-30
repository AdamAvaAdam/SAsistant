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
  threadHistory: (id, threadId, type) => invoke('sa:thread-history', id, threadId, type),
  markRead: (id, threadId, type, upto) => invoke('sa:read', id, threadId, type, upto),
  schedules: () => invoke('sa:schedules'),
  schedule: (id, body) => invoke('sa:schedule', id, body),
  cancelSchedule: id => invoke('sa:cancel-schedule', id),
  saveFile: ref => invoke('sa:save-file', ref),
  openLink: url => invoke('sa:open-link', url),
  remove: id => invoke('sa:remove', id),
  send: (id, body) => invoke('sa:send', id, body),
}));
