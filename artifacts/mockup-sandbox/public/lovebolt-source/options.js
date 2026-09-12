/**
 * LoveBoltReplit GPT Connector - Options Page Script v2
 */

document.addEventListener('DOMContentLoaded', async () => {
  const config = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });

  // Load settings
  document.getElementById('autoSync').checked = config.autoSync !== false;
  document.getElementById('notifications').checked = config.notifications !== false;
  
  // GitHub status
  if (config.connected.github && config.githubUser) {
    document.getElementById('githubStatusBadge').textContent = config.githubUser.login;
    document.getElementById('githubStatusBadge').className = 'status-badge connected';
    document.getElementById('githubUserInfo').style.display = 'flex';
    document.getElementById('githubAvatarLarge').src = config.githubUser.avatar_url;
    document.getElementById('githubNameLarge').textContent = config.githubUser.login;
    document.getElementById('githubDetailLarge').textContent = `${config.githubUser.public_repos} repositórios públicos`;
  }

  // Supabase status
  if (config.connected.supabase && config.supabaseProjectRef) {
    document.getElementById('supabaseStatusBadge').textContent = config.supabaseProjectRef;
    document.getElementById('supabaseStatusBadge').className = 'status-badge connected';
    document.getElementById('supabaseConfigForm').style.display = 'none';
    document.getElementById('supabaseConnectedInfo').style.display = 'flex';
    document.getElementById('supabaseProjectLarge').textContent = config.supabaseProjectRef;
    document.getElementById('supabaseUrlLarge').textContent = config.supabaseUrl;
  } else {
    document.getElementById('supabaseUrl').value = config.supabaseUrl || '';
    document.getElementById('supabaseKey').value = config.supabaseAnonKey || '';
  }

  // Lovable status
  if (config.lovableProjects) {
    const lovableCount = config.lovableProjects.filter(p => p.hasLovable).length;
    document.getElementById('lovableStatusBadge').textContent = `${lovableCount} detectados`;
  }

  // ChatGPT status
  const chatgptResult = await chrome.runtime.sendMessage({ type: 'DETECT_CHATGPT' });
  document.getElementById('chatgptStatusBadge').textContent = chatgptResult.detected ? 'Ativo' : 'Inativo';

  // Save Supabase
  document.getElementById('saveSupabase').addEventListener('click', async () => {
    const url = document.getElementById('supabaseUrl').value.trim();
    const key = document.getElementById('supabaseKey').value.trim();
    
    if (!url || !key) {
      alert('Preencha a URL e a chave do Supabase');
      return;
    }
    
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'SETUP_SUPABASE',
        projectUrl: url,
        anonKey: key,
      });
      
      if (result.error) throw new Error(result.error);
      
      document.getElementById('supabaseStatusBadge').textContent = result.projectRef;
      document.getElementById('supabaseStatusBadge').className = 'status-badge connected';
      document.getElementById('supabaseConfigForm').style.display = 'none';
      document.getElementById('supabaseConnectedInfo').style.display = 'flex';
      document.getElementById('supabaseProjectLarge').textContent = result.projectRef;
      document.getElementById('supabaseUrlLarge').textContent = result.url;
      
      showToast();
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  });

  // Save all settings
  document.getElementById('saveBtn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({
      type: 'SET_CONFIG',
      config: {
        autoSync: document.getElementById('autoSync').checked,
        notifications: document.getElementById('notifications').checked,
      },
    });
    showToast();
  });

  function showToast() {
    const toast = document.getElementById('saveToast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
});
