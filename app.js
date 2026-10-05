/**
 * app.js
 * Темная Башня - Основная логика приложения
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // СОСТОЯНИЕ ПРИЛОЖЕНИЯ (State Management)
  // ==========================================
  const STORAGE_KEY = 'dark_tower_app_state';

  const defaultCharacter = () => ({
    id: 'char_' + Date.now(),
    name: '',
    race: '',
    concept: '',
    km: 0,
    dinars: 100,
    description: '',
    avatar: '',
    attributes: {
      constitution: { die: 'd6', damaged: 0 },
      intellect: { die: 'd8', damaged: 0 },
      empathy: { die: 'd8', damaged: 0 },
      spirit: { die: 'd10', damaged: 0 }
    },
    scars: '',
    skills: '',
    perks: [],
    inventory: {
      mode: 'grid',
      text: '',
      grid: [],
      items: []
    },
    defense: {
      armor: [
        { name: '', die: '—', type: 'light', durMax: 10, damaged: 0, rules: '' },
        { name: '', die: '—', type: 'medium', durMax: 10, damaged: 0, rules: '' },
        { name: '', die: '—', type: 'heavy', durMax: 10, damaged: 0, rules: '' }
      ],
      shield: { name: '', die: '—', durMax: 8, damaged: 0 }
    },
    weapons: [
      { name: '', die: '—', durMax: 10, damaged: 0, rules: '' },
      { name: '', die: '—', durMax: 10, damaged: 0, rules: '' },
      { name: '', die: '—', durMax: 10, damaged: 0, rules: '' }
    ],
    magic: {
      disciplines: [
        { name: '', attr: 'Дух' },
        { name: '', attr: 'Телосложение' }
      ],
      affect: 0,
      concentration: false,
      notes: ''
    },
    notes: ''
  });

  let AppState = {
    theme: 'dark',
    activeCharId: null,
    characters: []
  };

  function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        AppState = JSON.parse(saved);
      } catch (e) {
        console.error("Ошибка загрузки сохранений", e);
      }
    }
    if (!AppState.characters || AppState.characters.length === 0) {
      const initialChar = defaultCharacter();
      AppState.characters = [initialChar];
      AppState.activeCharId = initialChar.id;
    }
    if (!AppState.activeCharId || !AppState.characters.find(c => c.id === AppState.activeCharId)) {
      AppState.activeCharId = AppState.characters[0].id;
    }
    applyTheme(AppState.theme);
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState));
  }

  function getActiveChar() {
    return AppState.characters.find(c => c.id === AppState.activeCharId) || AppState.characters[0];
  }

  // ==========================================
  // УТИЛИТЫ И TOAST-УВЕДОМЛЕНИЯ
  // ==========================================
  const toastContainer = document.getElementById('toastContainer');
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  const dieValue = (dieStr) => parseInt(dieStr.replace('d', '')) || 0;

  // ==========================================
  // МОДАЛЬНЫЕ ОКНА
  // ==========================================
  document.querySelectorAll('.modal-close-btn, [data-close-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modalId = e.currentTarget.getAttribute('data-close-modal');
      closeModal(modalId);
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('is-active');
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.is-active').forEach(m => m.classList.remove('is-active'));
    }
  });

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('is-active');
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('is-active');
  }

  // ==========================================
  // РЕНДЕР И ПРИВЯЗКИ (UI Bindings)
  // ==========================================
  function renderAll() {
    renderTopBar();
    renderSheet();
  }

  // --- TOP BAR ---
  const charSelect = document.getElementById('characterSelect');
  const themeSelector = document.getElementById('themeSelector');
  
  function applyTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    themeSelector.value = themeName;
  }

  themeSelector.addEventListener('change', (e) => {
    AppState.theme = e.target.value;
    applyTheme(AppState.theme);
    saveState();
  });

  function renderTopBar() {
    charSelect.innerHTML = '';
    AppState.characters.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name || 'Без имени';
      if (c.id === AppState.activeCharId) opt.selected = true;
      charSelect.appendChild(opt);
    });
  }

  charSelect.addEventListener('change', (e) => {
    AppState.activeCharId = e.target.value;
    saveState();
    renderSheet();
    showToast('Персонаж переключен', 'info');
  });

  document.getElementById('btnNewChar').addEventListener('click', () => {
    const newChar = defaultCharacter();
    AppState.characters.push(newChar);
    AppState.activeCharId = newChar.id;
    saveState();
    renderAll();
    showToast('Новый персонаж создан', 'success');
  });

  document.getElementById('btnDeleteChar').addEventListener('click', () => {
    if (confirm('Вы уверены, что хотите удалить текущего персонажа?')) {
      AppState.characters = AppState.characters.filter(c => c.id !== AppState.activeCharId);
      if (AppState.characters.length === 0) {
        AppState.characters.push(defaultCharacter());
      }
      AppState.activeCharId = AppState.characters[0].id;
      saveState();
      renderAll();
      showToast('Персонаж удален', 'danger');
    }
  });

  // --- ОСНОВНОЙ ЛИСТ (Sheet) ---
  function bindInput(id, fieldPath, parser = (v) => v) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', (e) => {
      const char = getActiveChar();
      let ref = char;
      const parts = fieldPath.split('.');
      for (let i = 0; i < parts.length - 1; i++) ref = ref[parts[i]];
      ref[parts[parts.length - 1]] = parser(e.target.value);
      saveState();
    });
  }

  bindInput('charName', 'name');
  bindInput('charRace', 'race');
  bindInput('charConcept', 'concept');
  bindInput('charKM', 'km', parseInt);
  bindInput('charDinars', 'dinars', parseFloat);
  bindInput('charDescription', 'description');
  bindInput('charScars', 'scars');
  bindInput('charSkills', 'skills');
  bindInput('charNotes', 'notes');

  function renderSheet() {
    const char = getActiveChar();
    
    document.getElementById('charName').value = char.name;
    document.getElementById('charRace').value = char.race;
    document.getElementById('charConcept').value = char.concept;
    document.getElementById('charKM').value = char.km || 0;
    document.getElementById('charDinars').value = char.dinars || 0;
    document.getElementById('charDescription').value = char.description;
    document.getElementById('charScars').value = char.scars;
    document.getElementById('charSkills').value = char.skills;
    document.getElementById('charNotes').value = char.notes;

    renderAttributes(char);
    renderPerks(char);
    renderDefense(char);
    renderWeapons(char);
    renderMagic(char);
    renderAvatar(char);
  }

  // --- ПОРТРЕТ / АРТ ПЕРСОНАЖА ---
  const avatarContainer = document.getElementById('avatarContainer');
  const avatarImage = document.getElementById('avatarImage');
  const btnRemoveAvatar = document.getElementById('btnRemoveAvatar');
  const btnUploadAvatar = document.getElementById('btnUploadAvatar');
  const avatarFileInput = document.getElementById('avatarFileInput');

  function renderAvatar(char) {
    if (char.avatar) {
      avatarImage.src = char.avatar;
      avatarContainer.style.display = 'block';
      btnRemoveAvatar.style.display = 'inline-block';
      btnUploadAvatar.textContent = '🖼️ Сменить арт';
    } else {
      avatarImage.src = '';
      avatarContainer.style.display = 'none';
      btnRemoveAvatar.style.display = 'none';
      btnUploadAvatar.textContent = '🖼️ Загрузить арт';
    }
  }

  btnUploadAvatar.addEventListener('click', () => avatarFileInput.click());
  avatarContainer.addEventListener('click', () => avatarFileInput.click());

  avatarFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round(height * (MAX_SIZE / width));
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round(width * (MAX_SIZE / height));
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const char = getActiveChar();
        char.avatar = dataUrl;
        saveState();
        renderAvatar(char);
        showToast('Арт персонажа сохранен!', 'success');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  btnRemoveAvatar.addEventListener('click', (e) => {
    e.stopPropagation();
    const char = getActiveChar();
    char.avatar = '';
    saveState();
    renderAvatar(char);
    showToast('Арт персонажа удален', 'info');
  });

  // --- АТРИБУТЫ И ЗДОРОВЬЕ ---
  const ATTRS = ['constitution', 'intellect', 'empathy', 'spirit'];
  
  ATTRS.forEach(attr => {
    const sel = document.getElementById(`die_${attr}`);
    sel.addEventListener('change', (e) => {
      const char = getActiveChar();
      char.attributes[attr].die = e.target.value;
      saveState();
      renderAttributes(char);
    });
  });

  function renderAttributes(char) {
    ATTRS.forEach(attr => {
      const data = char.attributes[attr];
      document.getElementById(`die_${attr}`).value = data.die;
      
      const track = document.getElementById(`hpTrack_${attr}`);
      track.innerHTML = '';
      
      const maxHp = dieValue(data.die);
      
      let html1 = '<div class="hp-row">';
      let html2 = '<div class="hp-row">';
      
      for (let i = 1; i <= 20; i++) {
        let classes = 'hp-box';
        if (i > maxHp) classes += ' is-disabled';
        else if ([4, 6, 8, 10, 12, 20].includes(i)) classes += ' is-threshold';
        
        if (i <= data.damaged && i <= maxHp) classes += ' is-damaged';

        const boxStr = `<div class="${classes}" data-attr="${attr}" data-val="${i}"></div>`;
        if (i <= 10) html1 += boxStr;
        else html2 += boxStr;
      }
      html1 += '</div>';
      html2 += '</div>';
      
      const statusLine = `<div class="hp-controls-mini">
        <span>Урон: ${data.damaged}</span>
        <span>Текущие ОЗ: <span class="hp-status-val">${Math.max(0, maxHp - data.damaged)}</span></span>
      </div>`;
      
      track.innerHTML = html1 + html2 + statusLine;
    });

    // Привязываем клики по коробкам ХП
    document.querySelectorAll('.hp-box:not(.is-disabled)').forEach(box => {
      box.addEventListener('click', (e) => {
        const attr = e.target.getAttribute('data-attr');
        const val = parseInt(e.target.getAttribute('data-val'));
        const char = getActiveChar();
        
        if (char.attributes[attr].damaged === val) {
          char.attributes[attr].damaged = val - 1; // клик по уже выделенному убирает его
        } else {
          char.attributes[attr].damaged = val;
        }
        saveState();
        renderAttributes(char);
      });
    });
  }

  // --- БРОНЯ И ОРУЖИЕ ---
  function renderDurabilityBoxes(container, max, damaged, type, idx) {
    if (!container) return;
    container.innerHTML = '';
    const row1 = document.createElement('div'); row1.style.display = 'flex'; row1.style.gap = '3px';
    const row2 = document.createElement('div'); row2.style.display = 'flex'; row2.style.gap = '3px';
    
    for (let i = 1; i <= max; i++) {
      const box = document.createElement('div');
      box.className = 'dur-box' + (i <= damaged ? ' is-damaged' : '');
      box.title = `Очки прочности: ${i}/${max} (клик для отметки)`;
      box.addEventListener('click', () => {
        const char = getActiveChar();
        let target;
        if (type === 'armor') target = char.defense.armor[idx];
        else if (type === 'shield') target = char.defense.shield;
        else if (type === 'weapon') target = char.weapons[idx];
        
        target.damaged = target.damaged === i ? i - 1 : i;
        saveState();
        if(type==='weapon') renderWeapons(char); else renderDefense(char);
      });
      if (i <= Math.ceil(max / 2)) row1.appendChild(box);
      else row2.appendChild(box);
    }
    container.appendChild(row1);
    container.appendChild(row2);
  }

  function renderDefense(char) {
    // Броня
    char.defense.armor.forEach((a, idx) => {
      const card = document.querySelector(`.defense-card[data-armor-idx="${idx}"]`);
      if(!card) return;
      card.querySelector('.armor-name').value = a.name;
      card.querySelector('.armor-die').value = a.die;
      card.querySelector('.armor-rules').value = a.rules;
      card.querySelector(`input[value="${a.type}"]`).checked = true;
      renderDurabilityBoxes(card.querySelector('.armor-dur-boxes'), a.durMax, a.damaged, 'armor', idx);
    });

    // Щит
    document.getElementById('shieldName').value = char.defense.shield.name;
    document.getElementById('shieldDie').value = char.defense.shield.die;
    renderDurabilityBoxes(document.getElementById('shieldDurBoxes'), char.defense.shield.durMax, char.defense.shield.damaged, 'shield', 0);
  }

  document.querySelectorAll('.defense-card').forEach((card, idx) => {
    card.querySelector('.armor-name').addEventListener('input', e => { getActiveChar().defense.armor[idx].name = e.target.value; saveState(); });
    card.querySelector('.armor-die').addEventListener('change', e => { getActiveChar().defense.armor[idx].die = e.target.value; saveState(); });
    card.querySelector('.armor-rules').addEventListener('input', e => { getActiveChar().defense.armor[idx].rules = e.target.value; saveState(); });
    card.querySelectorAll('input[type="radio"]').forEach(rad => {
      rad.addEventListener('change', e => { getActiveChar().defense.armor[idx].type = e.target.value; saveState(); });
    });
  });

  document.getElementById('shieldName').addEventListener('input', e => { getActiveChar().defense.shield.name = e.target.value; saveState(); });
  document.getElementById('shieldDie').addEventListener('change', e => { getActiveChar().defense.shield.die = e.target.value; saveState(); });

  function renderWeapons(char) {
    char.weapons.forEach((w, idx) => {
      const card = document.querySelector(`.weapon-card[data-weapon-idx="${idx}"]`);
      if(!card) return;
      card.querySelector('.weapon-name').value = w.name;
      card.querySelector('.weapon-die').value = w.die;
      card.querySelector('.weapon-rules').value = w.rules;
      renderDurabilityBoxes(card.querySelector('.weapon-dur-boxes'), w.durMax, w.damaged, 'weapon', idx);
    });
  }

  document.querySelectorAll('.weapon-card').forEach((card, idx) => {
    card.querySelector('.weapon-name').addEventListener('input', e => { getActiveChar().weapons[idx].name = e.target.value; saveState(); });
    card.querySelector('.weapon-die').addEventListener('change', e => { getActiveChar().weapons[idx].die = e.target.value; saveState(); });
    card.querySelector('.weapon-rules').addEventListener('input', e => { getActiveChar().weapons[idx].rules = e.target.value; saveState(); });
  });

  // --- ПЕРКИ ---
  const perksTbody = document.getElementById('perksTbody');
  document.getElementById('btnAddPerkRow').addEventListener('click', () => {
    getActiveChar().perks.push({ name: '', cost: 0 });
    saveState();
    renderPerks(getActiveChar());
  });

  function renderPerks(char) {
    perksTbody.innerHTML = '';
    let totalKm = 0;
    char.perks.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="perk-name-input" value="${p.name}" placeholder="Название перка"></td>
        <td><input type="number" class="perk-cost-input" value="${p.cost}" min="0"></td>
        <td class="no-print"><button class="btn btn-icon" style="color:var(--accent-crimson)" title="Удалить">✕</button></td>
      `;
      tr.querySelector('.perk-name-input').addEventListener('input', e => { p.name = e.target.value; saveState(); });
      tr.querySelector('.perk-cost-input').addEventListener('input', e => { 
        p.cost = parseInt(e.target.value) || 0; 
        saveState(); 
        updatePerksTotal(); 
      });
      tr.querySelector('button').addEventListener('click', () => {
        char.perks.splice(idx, 1);
        saveState();
        renderPerks(char);
      });
      perksTbody.appendChild(tr);
      totalKm += p.cost;
    });
    updatePerksTotal();
  }
  
  function updatePerksTotal() {
    const total = getActiveChar().perks.reduce((sum, p) => sum + (parseInt(p.cost) || 0), 0);
    document.getElementById('totalKmSpent').textContent = total;
  }

  // --- МАГИЯ ---
  const magicRows = document.querySelectorAll('#magicDisciplinesTbody tr');
  function renderMagic(char) {
    magicRows.forEach((row, idx) => {
      if (char.magic.disciplines[idx]) {
        row.querySelector('.magic-disc-name').value = char.magic.disciplines[idx].name;
        row.querySelector('.magic-disc-attr').value = char.magic.disciplines[idx].attr;
      }
    });
    document.getElementById('magicAffectCount').value = char.magic.affect;
    document.getElementById('magicConcentrationCheck').checked = char.magic.concentration;
    document.getElementById('magicNotes').value = char.magic.notes;
  }

  magicRows.forEach((row, idx) => {
    row.querySelector('.magic-disc-name').addEventListener('input', e => { getActiveChar().magic.disciplines[idx].name = e.target.value; saveState(); });
    row.querySelector('.magic-disc-attr').addEventListener('change', e => { getActiveChar().magic.disciplines[idx].attr = e.target.value; saveState(); });
  });
  
  document.getElementById('magicAffectCount').addEventListener('input', e => { getActiveChar().magic.affect = parseInt(e.target.value) || 0; saveState(); });
  document.getElementById('magicConcentrationCheck').addEventListener('change', e => { getActiveChar().magic.concentration = e.target.checked; saveState(); });
  document.getElementById('magicNotes').addEventListener('input', e => { getActiveChar().magic.notes = e.target.value; saveState(); });
  
  document.getElementById('btnResetAffectKm').addEventListener('click', () => {
    const char = getActiveChar();
    if (char.magic.affect > 0 && char.km > 0) {
      char.magic.affect--;
      char.km--;
      saveState();
      renderSheet();
      showToast('Аффект снижен за счет 1 КМ', 'success');
    } else {
      showToast('Недостаточно КМ или аффект уже 0', 'danger');
    }
  });

  // ==========================================
  // ДАЙСРОЛЛЕР (Кубики)
  // ==========================================
  const rollMainResult = document.getElementById('rollMainResult');
  const rollDetails = document.getElementById('rollDetails');
  const rollHistory = document.getElementById('rollHistory');
  
  document.getElementById('btnOpenDice').addEventListener('click', () => openModal('diceModal'));
  
  document.querySelectorAll('.btn-die').forEach(btn => {
    btn.addEventListener('click', () => {
      const sides = parseInt(btn.getAttribute('data-die'));
      const mode = document.querySelector('input[name="roll_type"]:checked').value;
      performRoll(sides, mode, `Бросок d${sides}`);
    });
  });

  function performRoll(sides, mode, title = "Бросок") {
    if(!sides) return;
    
    let res1 = Math.floor(Math.random() * sides) + 1;
    let res2 = Math.floor(Math.random() * sides) + 1;
    let finalRes = res1;
    let detailText = `Обычный бросок (d${sides})`;

    if (mode === 'adv') {
      finalRes = Math.max(res1, res2);
      detailText = `Преимущество: [${res1}, ${res2}] -> ${finalRes}`;
    } else if (mode === 'dis') {
      finalRes = Math.min(res1, res2);
      detailText = `Помеха: [${res1}, ${res2}] -> ${finalRes}`;
    }

    // Анимация
    rollMainResult.style.transform = 'scale(1.5)';
    rollMainResult.style.color = '#fff';
    setTimeout(() => {
      rollMainResult.style.transform = 'scale(1)';
      rollMainResult.style.color = 'var(--accent-gold)';
    }, 150);

    rollMainResult.textContent = finalRes;
    rollDetails.textContent = detailText;

    const histItem = document.createElement('div');
    histItem.innerHTML = `<strong>${title}:</strong> ${finalRes} <span style="color:var(--text-muted);font-size:10px;">(${detailText})</span>`;
    rollHistory.prepend(histItem);
  }

  // Привязка кнопок бросков на листе
  document.querySelectorAll('.attr-roll-btn').forEach(btn => {
    if (btn.id === 'btnRollShield') {
      btn.addEventListener('click', () => {
        const d = dieValue(document.getElementById('shieldDie').value);
        if (d) { openModal('diceModal'); performRoll(d, 'normal', 'Бросок Щита'); }
      });
      return;
    }
    btn.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (tr) {
        const attrName = tr.querySelector('span').textContent;
        const die = dieValue(tr.querySelector('.die-select').value);
        if (die) { openModal('diceModal'); performRoll(die, 'normal', `Проверка: ${attrName}`); }
      }
    });
  });

  document.querySelectorAll('.armor-roll-btn').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const d = dieValue(getActiveChar().defense.armor[idx].die);
      if (d) { openModal('diceModal'); performRoll(d, 'normal', `Бросок брони ${idx+1}`); }
    });
  });

  document.querySelectorAll('.weapon-roll-btn').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const d = dieValue(getActiveChar().weapons[idx].die);
      if (d) { openModal('diceModal'); performRoll(d, 'normal', `Урон: ${getActiveChar().weapons[idx].name || 'Оружие'}`); }
    });
  });

  // ==========================================
  // ЭКСПОРТ И ИМПОРТ JSON
  // ==========================================
  document.getElementById('btnExportJson').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(getActiveChar(), null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `char_${getActiveChar().name || 'unnamed'}.json`);
    dlAnchorElem.click();
  });

  document.getElementById('btnImportJson').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });

  document.getElementById('importFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!imported.id || !imported.attributes) throw new Error("Неверный формат");
        imported.id = 'char_' + Date.now(); // force new id
        AppState.characters.push(imported);
        AppState.activeCharId = imported.id;
        saveState();
        renderAll();
        showToast('Персонаж успешно импортирован', 'success');
      } catch (err) {
        showToast('Ошибка импорта: ' + err.message, 'danger');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset
  });

  document.getElementById('btnPrintSheet').addEventListener('click', () => {
    window.print();
  });

  // ==========================================
  // ИНВЕНТАРЬ (Inventory Grid & Item Labeling)
  // ==========================================
  const invGridContainer = document.getElementById('inventoryGrid');
  const invListContainer = document.getElementById('invListContainer');
  const invGridWrap = document.getElementById('invGridContainer');
  const inventoryText = document.getElementById('inventoryText');
  const invItemLabelInput = document.getElementById('invItemLabelInput');
  const btnAssignInvLabel = document.getElementById('btnAssignInvLabel');
  const btnQuickAddItem = document.getElementById('btnQuickAddItem');
  const btnDeleteInvItem = document.getElementById('btnDeleteInvItem');
  const btnClearInvSelection = document.getElementById('btnClearInvSelection');
  const invSelectionInfo = document.getElementById('invSelectionInfo');

  let selectedCells = new Set();
  let isSelectingGrid = false;
  let dragAnchorIndex = null;

  function initGrid() {
    invGridContainer.innerHTML = '';
    for (let i = 0; i < 250; i++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.index = i;

      cell.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // only left click
        isSelectingGrid = true;
        dragAnchorIndex = i;

        const char = getActiveChar();
        const existingItem = (char.inventory.items || []).find(it => it.cells.includes(i));
        if (existingItem) {
          selectedCells = new Set(existingItem.cells);
          invItemLabelInput.value = existingItem.name;
          updateSelectionUI();
          isSelectingGrid = false;
          return;
        }

        if (e.shiftKey) {
          if (selectedCells.has(i)) selectedCells.delete(i);
          else selectedCells.add(i);
        } else {
          selectedCells = new Set([i]);
        }
        updateSelectionUI();
      });

      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const char = getActiveChar();
        const existingItem = (char.inventory.items || []).find(it => it.cells.includes(i));
        if (existingItem) {
          if (confirm(`Удалить предмет «${existingItem.name}» (${existingItem.cells.length} ячеек) с сетки?`)) {
            deleteItemFromInventory(existingItem);
          }
        }
      });

      cell.addEventListener('mouseenter', () => {
        if (isSelectingGrid && dragAnchorIndex !== null) {
          const startCol = dragAnchorIndex % 25;
          const startRow = Math.floor(dragAnchorIndex / 25);
          const currCol = i % 25;
          const currRow = Math.floor(i / 25);

          const minCol = Math.min(startCol, currCol);
          const maxCol = Math.max(startCol, currCol);
          const minRow = Math.min(startRow, currRow);
          const maxRow = Math.max(startRow, currRow);

          selectedCells = new Set();
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              selectedCells.add(r * 25 + c);
            }
          }
          updateSelectionUI();
        }
      });

      invGridContainer.appendChild(cell);
    }

    document.addEventListener('mouseup', () => {
      isSelectingGrid = false;
      dragAnchorIndex = null;
    });
  }

  function updateSelectionUI() {
    const cells = invGridContainer.children;
    for (let i = 0; i < 250; i++) {
      if (selectedCells.has(i)) {
        cells[i].classList.add('cell-selected');
      } else {
        cells[i].classList.remove('cell-selected');
      }
    }

    if (selectedCells.size === 0) {
      invSelectionInfo.textContent = 'Выделите ячейки мышью (например, 2×8) и нажмите «Подписать»';
      invSelectionInfo.style.color = 'var(--text-muted)';
      if (btnDeleteInvItem) {
        btnDeleteInvItem.disabled = true;
        btnDeleteInvItem.style.opacity = '0.5';
      }
    } else {
      const cols = Array.from(selectedCells).map(idx => idx % 25);
      const rows = Array.from(selectedCells).map(idx => Math.floor(idx / 25));
      const w = Math.max(...cols) - Math.min(...cols) + 1;
      const h = Math.max(...rows) - Math.min(...rows) + 1;
      const char = getActiveChar();
      const matchedItem = (char.inventory.items || []).find(it => it.cells.some(c => selectedCells.has(c)));
      const itemNameStr = matchedItem ? ` — «${matchedItem.name}»` : '';
      invSelectionInfo.textContent = `Выделено: ${selectedCells.size} яч. (${w}×${h})${itemNameStr}`;
      invSelectionInfo.style.color = 'var(--accent-gold)';
      if (btnDeleteInvItem) {
        btnDeleteInvItem.disabled = false;
        btnDeleteInvItem.style.opacity = '1';
      }
    }
  }

  function renderInventoryGrid(char) {
    if (!char.inventory.items) char.inventory.items = [];
    if (!char.inventory.grid) char.inventory.grid = [];

    const cells = invGridContainer.children;
    for (let i = 0; i < 250; i++) {
      cells[i].className = 'grid-cell';
      cells[i].innerHTML = '';
      cells[i].removeAttribute('title');
      if (selectedCells.has(i)) cells[i].classList.add('cell-selected');
    }

    // Render placed items
    char.inventory.items.forEach(item => {
      if (!item.cells || item.cells.length === 0) return;
      const sortedCells = [...item.cells].sort((a, b) => a - b);
      const cols = item.cells.map(c => c % 25);
      const rows = item.cells.map(c => Math.floor(c / 25));

      const minCol = Math.min(...cols);
      const maxCol = Math.max(...cols);
      const minRow = Math.min(...rows);
      const maxRow = Math.max(...rows);

      const itemWidth = maxCol - minCol + 1;
      const itemHeight = maxRow - minRow + 1;
      const topLeftIdx = minRow * 25 + minCol;

      item.cells.forEach(cIdx => {
        if (cells[cIdx]) {
          cells[cIdx].classList.add('cell-occupied');
          cells[cIdx].title = `${item.name} (${item.cells.length} ячеек) — кликните для выделения`;
        }
      });

      const targetCell = cells[topLeftIdx] || cells[sortedCells[0]];
      if (targetCell) {
        const label = document.createElement('span');
        label.className = 'grid-cell-label';
        label.textContent = item.name;
        label.style.setProperty('--item-cols', itemWidth);
        label.style.setProperty('--item-rows', itemHeight);
        targetCell.appendChild(label);
      }
    });

    // Support legacy grid array
    char.inventory.grid.forEach(idx => {
      if (cells[idx]) cells[idx].classList.add('cell-occupied');
    });
  }

  function renderInventoryState() {
    const char = getActiveChar();
    inventoryText.value = char.inventory.text || '';

    if (char.inventory.mode === 'list') {
      invGridWrap.style.display = 'none';
      invListContainer.style.display = 'flex';
    } else {
      invGridWrap.style.display = 'block';
      invListContainer.style.display = 'none';
      renderInventoryGrid(char);
    }
    updateSelectionUI();
  }

  btnAssignInvLabel.addEventListener('click', () => {
    if (selectedCells.size === 0) {
      showToast('Сначала выделите ячейки на сетке (например 2×8)!', 'warning');
      return;
    }

    let name = invItemLabelInput.value.trim();
    if (!name) {
      name = prompt('Введите название предмета (например: Лук, Доспех, Меч):');
      if (!name) return;
      invItemLabelInput.value = name;
    }

    const char = getActiveChar();
    if (!char.inventory.items) char.inventory.items = [];

    const cellArr = Array.from(selectedCells);

    // Remove overlapping items
    char.inventory.items = char.inventory.items.filter(it => !it.cells.some(c => cellArr.includes(c)));

    char.inventory.items.push({
      id: 'item_' + Date.now(),
      name: name,
      cells: cellArr
    });

    char.inventory.grid = Array.from(new Set([...(char.inventory.grid || []), ...cellArr]));

    if (char.inventory.text && !char.inventory.text.includes(name)) {
      char.inventory.text += `\n${name}`;
    } else if (!char.inventory.text) {
      char.inventory.text = name;
    }

    selectedCells.clear();
    invItemLabelInput.value = '';
    saveState();
    renderInventoryState();
    showToast(`Предмет «${name}» успешно размещен на сетке!`, 'success');
  });

  btnQuickAddItem.addEventListener('click', () => {
    const name = prompt('Название предмета (например: Лук, Меч, Щит):', 'Лук');
    if (!name) return;
    const wStr = prompt('Ширина в ячейках (от 1 до 25):', '2');
    if (!wStr) return;
    const hStr = prompt('Высота в ячейках (от 1 до 10):', '8');
    if (!hStr) return;

    const w = parseInt(wStr) || 1;
    const h = parseInt(hStr) || 1;

    const char = getActiveChar();
    if (!char.inventory.items) char.inventory.items = [];

    const occupied = new Set();
    char.inventory.items.forEach(it => it.cells.forEach(c => occupied.add(c)));

    let foundAnchor = null;
    outerLoop:
    for (let r = 0; r <= 10 - h; r++) {
      for (let c = 0; c <= 25 - w; c++) {
        let fits = true;
        for (let dr = 0; dr < h; dr++) {
          for (let dc = 0; dc < w; dc++) {
            if (occupied.has((r + dr) * 25 + (c + dc))) {
              fits = false;
              break;
            }
          }
          if (!fits) break;
        }
        if (fits) {
          foundAnchor = { r, c };
          break outerLoop;
        }
      }
    }

    if (!foundAnchor) {
      showToast(`Не найдено свободного места ${w}×${h} на сетке!`, 'danger');
      return;
    }

    const itemCells = [];
    for (let dr = 0; dr < h; dr++) {
      for (let dc = 0; dc < w; dc++) {
        itemCells.push((foundAnchor.r + dr) * 25 + (foundAnchor.c + dc));
      }
    }

    char.inventory.items.push({
      id: 'item_' + Date.now(),
      name: name,
      cells: itemCells
    });

    char.inventory.grid = Array.from(new Set([...(char.inventory.grid || []), ...itemCells]));

    if (char.inventory.text && !char.inventory.text.includes(name)) {
      char.inventory.text += `\n${name}`;
    } else if (!char.inventory.text) {
      char.inventory.text = name;
    }

    saveState();
    renderInventoryState();
    showToast(`Предмет «${name}» (${w}×${h}) размещен!`, 'success');
  });

  function deleteItemFromInventory(item) {
    const char = getActiveChar();
    if (!char.inventory.items) char.inventory.items = [];
    char.inventory.items = char.inventory.items.filter(it => it.id !== item.id);
    const itemCellSet = new Set(item.cells);
    char.inventory.grid = (char.inventory.grid || []).filter(c => !itemCellSet.has(c));
    selectedCells.clear();
    invItemLabelInput.value = '';
    saveState();
    renderInventoryState();
    showToast(`Предмет «${item.name}» удален с сетки`, 'info');
  }

  function deleteSelectedInventoryItems() {
    if (selectedCells.size === 0) {
      showToast('Сначала выделите предмет или ячейки на сетке!', 'warning');
      return;
    }
    const char = getActiveChar();
    if (!char.inventory.items) char.inventory.items = [];
    const cellArr = Array.from(selectedCells);
    const itemsToDelete = char.inventory.items.filter(it => it.cells.some(c => cellArr.includes(c)));

    if (itemsToDelete.length > 0) {
      const names = itemsToDelete.map(it => `«${it.name}»`).join(', ');
      char.inventory.items = char.inventory.items.filter(it => !itemsToDelete.includes(it));
      const deletedCellSet = new Set();
      itemsToDelete.forEach(it => it.cells.forEach(c => deletedCellSet.add(c)));
      cellArr.forEach(c => deletedCellSet.add(c));
      char.inventory.grid = (char.inventory.grid || []).filter(c => !deletedCellSet.has(c));
      selectedCells.clear();
      invItemLabelInput.value = '';
      saveState();
      renderInventoryState();
      showToast(`Предмет ${names} удален с сетки!`, 'info');
    } else {
      char.inventory.grid = (char.inventory.grid || []).filter(c => !cellArr.includes(c));
      selectedCells.clear();
      invItemLabelInput.value = '';
      saveState();
      renderInventoryState();
      showToast('Выделенные ячейки освобождены', 'info');
    }
  }

  if (btnDeleteInvItem) {
    btnDeleteInvItem.addEventListener('click', deleteSelectedInventoryItems);
  }

  btnClearInvSelection.addEventListener('click', () => {
    selectedCells.clear();
    invItemLabelInput.value = '';
    updateSelectionUI();
  });

  document.getElementById('btnToggleInvView').addEventListener('click', () => {
    const char = getActiveChar();
    char.inventory.mode = char.inventory.mode === 'grid' ? 'list' : 'grid';
    saveState();
    renderInventoryState();
  });

  document.getElementById('btnClearInvGrid').addEventListener('click', () => {
    if (confirm('Очистить всю сетку инвентаря? Все размещенные предметы будут удалены.')) {
      const char = getActiveChar();
      char.inventory.grid = [];
      char.inventory.items = [];
      selectedCells.clear();
      invItemLabelInput.value = '';
      saveState();
      renderInventoryState();
      showToast('Сетка инвентаря очищена', 'info');
    }
  });

  inventoryText.addEventListener('input', (e) => {
    getActiveChar().inventory.text = e.target.value;
    saveState();
  });

  // ==========================================
  // ДОПОЛНЕНИЯ К РЕНДЕРУ (патч)
  // ==========================================
  const originalRenderSheet = renderSheet;
  renderSheet = function() {
    originalRenderSheet();
    renderInventoryState();
  };
  
  // ==========================================
  // СПРАВОЧНИК ПРАВИЛ (Compendium)
  // ==========================================
  document.getElementById('btnOpenCompendium').addEventListener('click', () => {
    openModal('compendiumModal');
    renderCompendiumTab('tabRules'); // default tab
  });

  document.querySelectorAll('#compTabs .btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#compTabs .btn').forEach(b => b.classList.remove('btn-primary'));
      e.target.classList.add('btn-primary');
      renderCompendiumTab(e.target.getAttribute('data-tab'));
    });
  });

  function renderCompendiumTab(tabName) {
    const container = document.getElementById('compTabContent');
    container.innerHTML = '';
    
    if (tabName === 'tabRules') {
      container.innerHTML = `
        <div class="comp-card">
          <div class="comp-card-title">Базовые механики</div>
          <div class="shop-item-rules">Все проверки осуществляются броском одной из 4-х костей атрибутов: Телосложение, Интеллект, Эмпатия, Дух против кости Сложности (СЛ), задаваемой мастером. Успех — если выпавшее значение больше или равно значению СЛ.</div>
        </div>
        <div class="comp-card">
          <div class="comp-card-title">Градации сложности</div>
          <div class="shop-item-rules">d4 (очень легко), d6 (легко), d8 (средне), d10 (сложно), d12 (очень сложно), d20 (почти невозможно).</div>
        </div>
      `;
    } 
    else if (tabName === 'tabRaces') {
      GAME_DATA.races.forEach(r => {
        let traitsHtml = r.traits.map(t => `<div><strong>${t.name}:</strong> ${t.effect}</div>`).join('');
        container.innerHTML += `
          <div class="comp-card">
            <div class="comp-card-title">${r.name}</div>
            <div class="shop-item-rules">${r.desc}</div>
            <div style="font-size:12px; margin-top:6px; color:var(--accent-gold);">${traitsHtml}</div>
          </div>
        `;
      });
    }
    else if (tabName === 'tabSkills') {
      GAME_DATA.skills.forEach(s => {
        container.innerHTML += `
          <div class="comp-card">
            <div class="comp-card-title"><span>${s.name}</span> <span style="font-size:11px; color:var(--text-muted);">${s.attr}</span></div>
            <div class="shop-item-rules">${s.desc}</div>
          </div>
        `;
      });
    }
    else if (tabName === 'tabPerks') {
      GAME_DATA.perks.forEach(p => {
        const div = document.createElement('div');
        div.className = 'comp-card';
        div.innerHTML = `
          <div class="comp-card-title">
            <span>${p.name} <span style="font-size:11px; color:var(--text-muted);">(${p.category})</span></span>
            <span>Цена: ${p.costKM} КМ</span>
          </div>
          <div style="font-size:11px; color:var(--accent-blue); margin-bottom:4px;">Требование: ${p.req}</div>
          <div class="shop-item-rules">${p.desc}</div>
          <div style="margin-top:8px; text-align:right;">
            <button class="btn no-print" style="font-size:10px; padding:2px 8px;">➕ Добавить персонажу</button>
          </div>
        `;
        div.querySelector('button').addEventListener('click', () => {
          const char = getActiveChar();
          char.perks.push({ name: p.name, cost: p.costKM });
          saveState();
          renderPerks(char);
          showToast(`Перк "${p.name}" добавлен!`, 'success');
        });
        container.appendChild(div);
      });
    }
    else if (tabName === 'tabEquip') {
      container.innerHTML += '<h4 style="color:var(--accent-gold); border-bottom:1px solid var(--border-color); padding-bottom:4px; margin-top:8px;">Оружие</h4>';
      (GAME_DATA.equipment.weapons || []).forEach(w => {
        container.innerHTML += `
          <div class="comp-card">
            <div class="comp-card-title">
              <span>${w.name}</span>
              <span>${w.cost} ⌘</span>
            </div>
            <div style="font-size:12px; color:var(--accent-gold);">Урон: ${w.damage} | Прочность: ${w.durability}</div>
            <div class="shop-item-rules">${w.rules}</div>
          </div>
        `;
      });

      container.innerHTML += '<h4 style="color:var(--accent-gold); border-bottom:1px solid var(--border-color); padding-bottom:4px; margin-top:16px;">Броня</h4>';
      (GAME_DATA.equipment.armor || []).forEach(a => {
        container.innerHTML += `
          <div class="comp-card">
            <div class="comp-card-title">
              <span>${a.name}</span>
              <span>${a.cost} ⌘</span>
            </div>
            <div style="font-size:12px; color:var(--accent-gold);">Кость: ${a.die} | Тип: ${a.category} | Прочность: ${a.durability}</div>
            <div class="shop-item-rules">${a.rules}</div>
          </div>
        `;
      });

      container.innerHTML += '<h4 style="color:var(--accent-gold); border-bottom:1px solid var(--border-color); padding-bottom:4px; margin-top:16px;">Щиты</h4>';
      (GAME_DATA.equipment.shields || []).forEach(s => {
        container.innerHTML += `
          <div class="comp-card">
            <div class="comp-card-title">
              <span>${s.name}</span>
              <span>${s.cost} ⌘</span>
            </div>
            <div style="font-size:12px; color:var(--accent-gold);">Кость: ${s.die} | Прочность: ${s.durability}</div>
            <div class="shop-item-rules">${s.rules}</div>
          </div>
        `;
      });

      container.innerHTML += '<h4 style="color:var(--accent-gold); border-bottom:1px solid var(--border-color); padding-bottom:4px; margin-top:16px;">Снаряжение и припасы</h4>';
      const others = [...(GAME_DATA.equipment.ammo || []), ...(GAME_DATA.equipment.clothes || []), ...(GAME_DATA.equipment.camping || []), ...(GAME_DATA.equipment.magicBooks || [])];
      others.forEach(item => {
        container.innerHTML += `
          <div class="comp-card" style="padding:6px 10px;">
            <div class="comp-card-title" style="font-size:13px;">
              <span>${item.name}</span>
              <span>${item.cost} ⌘</span>
            </div>
          </div>
        `;
      });
    }
    else if (tabName === 'tabMagic') {
      container.innerHTML += `
        <div class="comp-card">
          <div class="comp-card-title">Правила сотворения магии</div>
          <div class="shop-item-rules"><strong>Требования:</strong> ${GAME_DATA.magic.rules.reqs}</div>
          <div class="shop-item-rules" style="margin-top:4px;"><strong>Сотворение:</strong> ${GAME_DATA.magic.rules.casting}</div>
          <div class="shop-item-rules" style="margin-top:4px;"><strong>Помехи от брони:</strong> Легкая (+1 ступень), Средняя (+2 ступени), Тяжелая (+3 ступени сложности).</div>
          <div class="shop-item-rules" style="margin-top:4px;"><strong>Аффект:</strong> ${GAME_DATA.magic.rules.affect}</div>
          <div class="shop-item-rules" style="margin-top:4px;"><strong>Концентрация:</strong> ${GAME_DATA.magic.rules.concentration}</div>
        </div>
      `;

      container.innerHTML += '<h4 style="color:var(--accent-gold); border-bottom:1px solid var(--border-color); padding-bottom:4px; margin-top:16px;">Магические дисциплины</h4>';
      GAME_DATA.magic.disciplines.forEach(d => {
        let tableRows = d.table ? d.table.map(row => `<tr><td style="padding:2px 6px; border:1px solid var(--border-color);">${row.example}</td><td style="padding:2px 6px; border:1px solid var(--border-color); text-align:center; font-weight:bold; color:var(--accent-gold);">${row.sl}</td></tr>`).join('') : '';
        let tableHtml = tableRows ? `
          <table style="width:100%; border-collapse:collapse; margin-top:6px; font-size:12px;">
            <thead><tr style="background:var(--bg-surface);"><th style="padding:2px 6px; border:1px solid var(--border-color); text-align:left;">Пример эффекта</th><th style="padding:2px 6px; border:1px solid var(--border-color); width:80px; text-align:center;">Сложность</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        ` : '';

        container.innerHTML += `
          <div class="comp-card" style="margin-bottom:10px;">
            <div class="comp-card-title"><span>${d.name}</span> <span style="font-size:11px; color:var(--accent-blue);">Атрибут: ${d.attr}</span></div>
            <div style="font-size:12px; color:var(--text-muted);">Базовая дистанция: ${d.baseRange}</div>
            <div style="font-size:12px; color:var(--text-muted);">Сила магии: ${d.power}</div>
            ${d.height ? `<div style="font-size:12px; color:var(--text-muted);">${d.height}</div>` : ''}
            ${tableHtml}
          </div>
        `;
      });
    }
  }

  document.getElementById('btnQuickPerks').addEventListener('click', () => {
    openModal('compendiumModal');
    document.querySelectorAll('#compTabs .btn').forEach(b => b.classList.remove('btn-primary'));
    document.querySelector('[data-tab="tabPerks"]').classList.add('btn-primary');
    renderCompendiumTab('tabPerks');
  });

  // ==========================================
  // ВЫБОР НАВЫКОВ (Skills Selector)
  // ==========================================
  document.getElementById('btnQuickSkills').addEventListener('click', () => {
    openModal('skillsModal');
    const container = document.getElementById('skillsCheckboxList');
    container.innerHTML = '';
    const currentSkillsText = getActiveChar().skills.toLowerCase();

    GAME_DATA.skills.forEach(s => {
      const isChecked = currentSkillsText.includes(s.name.toLowerCase());
      const lbl = document.createElement('label');
      lbl.className = 'custom-checkbox-label';
      lbl.style.padding = '4px';
      lbl.style.border = '1px solid var(--border-color)';
      lbl.style.borderRadius = 'var(--radius)';
      lbl.style.background = 'var(--bg-card)';
      lbl.innerHTML = `
        <input type="checkbox" value="${s.name}" ${isChecked ? 'checked' : ''}>
        <div>
          <div style="font-weight:bold; color:var(--accent-gold); font-size:13px;">${s.name} <span style="color:var(--text-muted); font-size:10px;">(${s.attr})</span></div>
          <div style="font-size:10px; color:var(--text-muted);">${s.desc}</div>
        </div>
      `;
      container.appendChild(lbl);
    });
  });

  document.getElementById('btnApplySelectedSkills').addEventListener('click', () => {
    const checked = Array.from(document.querySelectorAll('#skillsCheckboxList input:checked')).map(i => i.value);
    const char = getActiveChar();
    char.skills = checked.join('\n');
    saveState();
    renderSheet();
    closeModal('skillsModal');
    showToast('Навыки обновлены', 'success');
  });

  document.getElementById('btnRoll2d20Skills').addEventListener('click', () => {
    const skills = GAME_DATA.skills;
    const s1 = skills[Math.floor(Math.random() * 20)];
    let s2 = skills[Math.floor(Math.random() * 20)];
    while (s2.id === s1.id) s2 = skills[Math.floor(Math.random() * 20)]; // reroll duplicate
    
    document.querySelectorAll('#skillsCheckboxList input').forEach(cb => {
      cb.checked = (cb.value === s1.name || cb.value === s2.name);
    });
    showToast(`Выпали навыки: ${s1.name} и ${s2.name}`, 'info');
  });

  // ==========================================
  // МАГАЗИН (Shop)
  // ==========================================
  document.getElementById('btnOpenShop').addEventListener('click', () => {
    openModal('shopModal');
    renderShop();
  });

  function renderShop() {
    document.getElementById('shopDinarsDisplay').textContent = (getActiveChar().dinars || 0) + ' ⌘';
    const container = document.getElementById('shopCatalogContainer');
    container.innerHTML = '';
    
    const categories = {
      "Ближний бой": GAME_DATA.equipment.melee_weapons,
      "Стрелковое оружие": GAME_DATA.equipment.ranged_weapons,
      "Броня": GAME_DATA.equipment.armor,
      "Щиты": GAME_DATA.equipment.shields,
      "Снаряжение": GAME_DATA.equipment.camping,
      "Боеприпасы": GAME_DATA.equipment.ammo,
      "Одежда": GAME_DATA.equipment.clothes,
      "Магические фолианты": GAME_DATA.equipment.magicBooks
    };

    for (const [catName, items] of Object.entries(categories)) {
      if (!items) continue; // safety
      const grp = document.createElement('div');
      grp.innerHTML = `<h4 style="color:var(--accent-gold); border-bottom:1px solid var(--border-color); margin-top:8px; padding-bottom:4px;">${catName}</h4>`;
      const grid = document.createElement('div');
      grid.className = 'shop-grid';
      
      items.forEach(item => {
        const rulesStr = item.rules || item.discipline || '';
        const statsStr = item.damage || item.die || '';
        grid.innerHTML += `
          <div class="shop-item-card">
            <div>
              <div class="shop-item-title">${item.name}</div>
              ${statsStr ? `<div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">Кость: <strong>${statsStr}</strong></div>` : ''}
              <div class="shop-item-rules">${rulesStr}</div>
            </div>
            <div class="shop-item-bottom">
              <span class="shop-price-tag">${item.cost} ⌘</span>
              <button class="btn btn-primary btn-buy" data-name="${item.name}" data-cost="${item.cost}" style="font-size:11px; padding:4px 8px;">Купить</button>
            </div>
          </div>
        `;
      });
      grp.appendChild(grid);
      container.appendChild(grp);
    }

    container.querySelectorAll('.btn-buy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.getAttribute('data-name');
        const cost = parseFloat(e.target.getAttribute('data-cost'));
        const char = getActiveChar();
        
        if (document.getElementById('autoDeductDinars').checked) {
          if (char.dinars < cost) {
            showToast('Недостаточно динаров!', 'danger');
            return;
          }
          char.dinars -= cost;
        }

        // Add to inventory text
        if (char.inventory.text) char.inventory.text += `\n${name}`;
        else char.inventory.text = name;

        saveState();
        renderShop();
        renderSheet();
        showToast(`Куплено: ${name}`, 'success');
      });
    });
  }

  // ==========================================
  // ПРЕСЕТЫ ЭКИПИРОВКИ (Quick Presets)
  // ==========================================
  document.getElementById('btnQuickArmor').addEventListener('click', () => {
    openModal('quickPresetsModal');
    document.getElementById('quickPresetsTitle').innerHTML = '🛡️ Выбор защиты';
    const container = document.getElementById('quickPresetsBody');
    container.innerHTML = '<h4 style="color:var(--accent-gold); margin-bottom:8px;">Броня</h4>';
    
    GAME_DATA.equipment.armor.forEach(a => {
      container.innerHTML += `
        <div class="comp-card" style="margin-bottom:8px;">
          <div class="comp-card-title">${a.name} <span style="font-size:12px; color:var(--text-muted);">(${a.die}, ${a.category}, Пр:${a.durability})</span></div>
          <div class="shop-item-rules" style="margin-bottom:8px;">${a.rules}</div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-primary btn-equip-armor" data-idx="0" data-json='${JSON.stringify(a)}'>Надеть в слот 1</button>
            <button class="btn btn-equip-armor" data-idx="1" data-json='${JSON.stringify(a)}'>Надеть в слот 2</button>
            <button class="btn btn-equip-armor" data-idx="2" data-json='${JSON.stringify(a)}'>Надеть в слот 3</button>
          </div>
        </div>
      `;
    });

    container.innerHTML += '<h4 style="color:var(--accent-gold); margin-bottom:8px; margin-top:16px;">Щиты</h4>';
    GAME_DATA.equipment.shields.forEach(s => {
      container.innerHTML += `
        <div class="comp-card" style="margin-bottom:8px;">
          <div class="comp-card-title">${s.name} <span style="font-size:12px; color:var(--text-muted);">(${s.die}, Пр:${s.durability})</span></div>
          <div class="shop-item-rules" style="margin-bottom:8px;">${s.rules}</div>
          <button class="btn btn-primary btn-equip-shield" data-json='${JSON.stringify(s)}'>Взять щит</button>
        </div>
      `;
    });

    bindPresetButtons();
  });

  document.getElementById('btnQuickWeapons').addEventListener('click', () => {
    openModal('quickPresetsModal');
    document.getElementById('quickPresetsTitle').innerHTML = '⚔️ Выбор оружия';
    const container = document.getElementById('quickPresetsBody');
    container.innerHTML = '<h4 style="color:var(--accent-gold); margin-bottom:8px;">Оружие</h4>';
    
    const weapons = [...(GAME_DATA.equipment.melee_weapons || []), ...(GAME_DATA.equipment.ranged_weapons || [])];
    weapons.forEach(w => {
      container.innerHTML += `
        <div class="comp-card" style="margin-bottom:8px;">
          <div class="comp-card-title">${w.name} <span style="font-size:12px; color:var(--text-muted);">(${w.damage || w.die}, Пр:${w.durability})</span></div>
          <div class="shop-item-rules" style="margin-bottom:8px;">${w.rules}</div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-primary btn-equip-weapon" data-idx="0" data-json='${JSON.stringify(w)}'>В слот 1</button>
            <button class="btn btn-equip-weapon" data-idx="1" data-json='${JSON.stringify(w)}'>В слот 2</button>
            <button class="btn btn-equip-weapon" data-idx="2" data-json='${JSON.stringify(w)}'>В слот 3</button>
          </div>
        </div>
      `;
    });
    bindPresetButtons();
  });

  function bindPresetButtons() {
    document.querySelectorAll('.btn-equip-armor').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        const data = JSON.parse(e.target.getAttribute('data-json'));
        const char = getActiveChar();
        char.defense.armor[idx] = { 
          name: data.name, die: data.die, rules: data.rules, 
          durMax: data.durability, damaged: 0, 
          type: data.category === 'Легкая' ? 'light' : (data.category === 'Средняя' ? 'medium' : 'heavy')
        };
        saveState(); renderDefense(char); closeModal('quickPresetsModal'); showToast(`Броня ${data.name} надета`, 'success');
      });
    });
    
    document.querySelectorAll('.btn-equip-shield').forEach(btn => {
      btn.addEventListener('click', e => {
        const data = JSON.parse(e.target.getAttribute('data-json'));
        const char = getActiveChar();
        char.defense.shield = { name: data.name, die: data.die, durMax: data.durability, damaged: 0 };
        saveState(); renderDefense(char); closeModal('quickPresetsModal'); showToast(`Щит ${data.name} надет`, 'success');
      });
    });

    document.querySelectorAll('.btn-equip-weapon').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        const data = JSON.parse(e.target.getAttribute('data-json'));
        const char = getActiveChar();
        char.weapons[idx] = { name: data.name, die: data.damage || data.die, rules: data.rules, durMax: data.durability, damaged: 0 };
        saveState(); renderWeapons(char); closeModal('quickPresetsModal'); showToast(`Оружие ${data.name} экипировано`, 'success');
      });
    });
  }

  // ==========================================
  // СОТВОРЕНИЕ МАГИИ (Magic Casting Calculator)
  // ==========================================
  document.getElementById('btnQuickMagic').addEventListener('click', () => {
    openModal('compendiumModal');
    document.querySelectorAll('#compTabs .btn').forEach(b => b.classList.remove('btn-primary'));
    document.querySelector('[data-tab="tabMagic"]') && document.querySelector('[data-tab="tabMagic"]').classList.add('btn-primary');
    renderCompendiumTab('tabMagic'); // Assumes we add magic logic there if requested, for now just opens rules
  });

  document.getElementById('btnMagicCastRoll').addEventListener('click', () => {
    openModal('magicCastingModal');
    const container = document.getElementById('magicCastingBody');
    const char = getActiveChar();
    
    // Quick UI for magic calculator
    container.innerHTML = `
      <div class="magic-calc-box">
        <label>Дисциплина:</label>
        <select id="mcDiscipline" class="die-select" style="width:100%; color:var(--text-main); background:var(--bg-input);">
          ${GAME_DATA.magic.disciplines.map((d, i) => `<option value="${i}">${d.name} (${d.attr})</option>`).join('')}
        </select>
        
        <label>Уровень эффекта (базовая сложность):</label>
        <select id="mcBaseSL" class="die-select" style="width:100%; color:var(--text-main); background:var(--bg-input);">
          <option value="4">d4 - Простейший</option>
          <option value="6">d6 - Легкий</option>
          <option value="8">d8 - Средний</option>
          <option value="10">d10 - Сложный</option>
          <option value="12">d12 - Очень сложный</option>
          <option value="20">d20 - Магистр / Катастрофа</option>
        </select>
        
        <label>Носимая броня (штраф):</label>
        <select id="mcArmorPenalty" class="die-select" style="width:100%; color:var(--text-main); background:var(--bg-input);">
          <option value="0">Нет / Ткань (без штрафа)</option>
          <option value="1">Легкая (+1 ступень)</option>
          <option value="2">Средняя (+2 ступени)</option>
          <option value="3">Тяжелая (+3 ступени)</option>
        </select>
        
        <label>Дальность/Высота (штраф):</label>
        <select id="mcRangePenalty" class="die-select" style="width:100%; color:var(--text-main); background:var(--bg-input);">
          <option value="0">В пределах базовой (без штрафа)</option>
          <option value="1">+1 ступень (далеко)</option>
          <option value="2">+2 ступени (очень далеко)</option>
          <option value="3">+3 ступени (запредельно)</option>
        </select>
        
        <div style="font-size:12px; color:var(--text-muted);">Текущий Аффект персонажа: <strong style="color:var(--accent-crimson)">+${char.magic.affect}</strong> ступеней</div>
        
        <div class="calc-result-pill" style="margin-top:10px;">
          Итоговая Сложность (СЛ): <span id="mcFinalSL">d4</span>
        </div>
        
        <button id="mcRollBtn" class="btn btn-primary" style="margin-top:10px; font-size:16px; padding:10px;">🎲 Совершить бросок!</button>
      </div>
    `;

    const mcDiscipline = document.getElementById('mcDiscipline');
    const mcBaseSL = document.getElementById('mcBaseSL');
    const mcArmorPenalty = document.getElementById('mcArmorPenalty');
    const mcRangePenalty = document.getElementById('mcRangePenalty');
    const mcFinalSL = document.getElementById('mcFinalSL');
    
    const slLadder = [4, 6, 8, 10, 12, 20];
    let finalDie = 4;
    
    function recalcMagic() {
      let baseIdx = slLadder.indexOf(parseInt(mcBaseSL.value));
      if (baseIdx === -1) baseIdx = 0;
      let totalSteps = baseIdx + parseInt(mcArmorPenalty.value) + parseInt(mcRangePenalty.value) + char.magic.affect;
      if (totalSteps >= slLadder.length) totalSteps = slLadder.length - 1; // max d20
      finalDie = slLadder[totalSteps];
      mcFinalSL.textContent = 'd' + finalDie;
    }

    [mcDiscipline, mcBaseSL, mcArmorPenalty, mcRangePenalty].forEach(el => el.addEventListener('change', recalcMagic));
    recalcMagic();

    document.getElementById('mcRollBtn').addEventListener('click', () => {
      const disc = GAME_DATA.magic.disciplines[parseInt(mcDiscipline.value)];
      const attrName = disc.attr.split(' ')[0]; // Handle "Телосложение (сила — Эмпатия)"
      let actualAttr = 'spirit';
      if (attrName.includes('Телосложение')) actualAttr = 'constitution';
      if (attrName.includes('Интеллект')) actualAttr = 'intellect';
      if (attrName.includes('Эмпатия')) actualAttr = 'empathy';
      
      const charDie = dieValue(char.attributes[actualAttr].die);
      
      closeModal('magicCastingModal');
      openModal('diceModal');
      
      const playerRoll = Math.floor(Math.random() * charDie) + 1;
      const difficultyRoll = Math.floor(Math.random() * finalDie) + 1;
      
      const success = playerRoll >= difficultyRoll;
      
      rollMainResult.style.transform = 'scale(1.5)';
      rollMainResult.style.color = success ? 'var(--success-color)' : 'var(--accent-crimson)';
      setTimeout(() => { rollMainResult.style.transform = 'scale(1)'; }, 200);

      rollMainResult.textContent = `${playerRoll} vs ${difficultyRoll}`;
      rollDetails.textContent = success ? `УСПЕХ! Магия сотворена.` : `ПРОВАЛ. Магия не сработала.`;
      
      if (success) {
        char.magic.affect++;
        saveState();
        renderSheet();
        showToast('Успех: Аффект увеличен на 1', 'warning');
      }

      const histItem = document.createElement('div');
      histItem.innerHTML = `<strong style="color:${success ? 'var(--success-color)' : 'var(--accent-crimson)'}">${disc.name}:</strong> Игрок d${charDie} [${playerRoll}] против СЛ d${finalDie} [${difficultyRoll}] - <strong>${success ? 'УСПЕХ' : 'ПРОВАЛ'}</strong>`;
      rollHistory.prepend(histItem);
    });
  });

  // ==========================================
  // МАСТЕР СОЗДАНИЯ ПЕРСОНАЖА (Wizard)
  // ==========================================
  document.getElementById('btnOpenWizard').addEventListener('click', () => {
    openModal('wizardModal');
    startWizard();
  });

  let wizStep = 0;
  let wizData = {
    name: '', race: '', concept: '',
    attrs: { constitution: 'd6', intellect: 'd8', empathy: 'd8', spirit: 'd10' },
    skills: [], dinars: 100, inventory: ''
  };

  function startWizard() {
    wizStep = 0;
    wizData = {
      name: 'Новый герой', race: 'Человек', concept: 'Искатель приключений',
      attrs: { constitution: 'd6', intellect: 'd8', empathy: 'd8', spirit: 'd10' },
      skills: [], dinars: 100, inventory: ''
    };
    renderWizardStep();
  }

  function renderWizardStep() {
    const body = document.getElementById('wizardBody');
    const btnPrev = document.getElementById('btnWizardPrev');
    const btnNext = document.getElementById('btnWizardNext');
    
    // Progress UI
    let progressHtml = '<div class="wizard-progress">';
    const steps = ['Происхождение', 'Атрибуты', 'Навыки', 'Снаряжение', 'Итоги'];
    steps.forEach((s, i) => {
      let cls = 'wizard-step-pill';
      if (i === wizStep) cls += ' is-active';
      else if (i < wizStep) cls += ' is-done';
      progressHtml += `<div class="${cls}">${i+1}. ${s}</div>`;
    });
    progressHtml += '</div>';

    let contentHtml = '';

    if (wizStep === 0) {
      contentHtml = `
        <label>Имя персонажа</label>
        <input type="text" id="wzName" value="${wizData.name}" class="input-underline" style="background:var(--bg-input); width:100%; margin-bottom:12px;">
        <label>Концепция (класс/профессия)</label>
        <input type="text" id="wzConcept" value="${wizData.concept}" class="input-underline" style="background:var(--bg-input); width:100%; margin-bottom:12px;">
        <label>Раса (выберите карточку)</label>
        <div class="wizard-card-grid">
          ${GAME_DATA.races.map(r => `
            <div class="wizard-card ${wizData.race === r.name ? 'is-selected' : ''}" onclick="window.setWizRace('${r.name}')">
              <div class="wizard-card-title">${r.name}</div>
              <div class="wizard-card-desc">${r.desc}</div>
              <div style="font-size:10px; color:var(--accent-gold); margin-top:4px;">${r.traits.map(t=>t.name).join(', ')}</div>
            </div>
          `).join('')}
        </div>
      `;
    } 
    else if (wizStep === 1) {
      contentHtml = `
        <p style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">Распределите кости: <strong>d6, d8, d8, d10</strong> между характеристиками.</p>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${Object.keys(wizData.attrs).map(attr => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:8px; border:1px solid var(--border-color);">
              <span style="font-family:var(--font-heading); font-weight:bold;">${attr.toUpperCase()}</span>
              <select class="die-select wz-attr-select" data-attr="${attr}" style="width:80px; background:var(--bg-input);">
                <option value="d6" ${wizData.attrs[attr]==='d6'?'selected':''}>d6</option>
                <option value="d8" ${wizData.attrs[attr]==='d8'?'selected':''}>d8</option>
                <option value="d10" ${wizData.attrs[attr]==='d10'?'selected':''}>d10</option>
              </select>
            </div>
          `).join('')}
        </div>
        <p id="wzAttrWarn" style="color:var(--accent-crimson); font-size:12px; margin-top:8px; display:none;">Набор костей должен точно совпадать с d6, d8, d8, d10!</p>
      `;
    }
    else if (wizStep === 2) {
      let maxSkills = 2;
      if (wizData.race === 'Человек' || wizData.race === 'Дворф') maxSkills = 3; // basic handling
      
      contentHtml = `
        <p style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">Выберите навыки. Доступно: <strong>${maxSkills}</strong>.</p>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
          ${GAME_DATA.skills.map(s => `
            <label style="display:flex; align-items:center; gap:6px; background:var(--bg-card); padding:4px; border:1px solid var(--border-color);">
              <input type="checkbox" class="wz-skill-cb" value="${s.name}" ${wizData.skills.includes(s.name)?'checked':''}>
              <span style="font-size:12px;">${s.name}</span>
            </label>
          `).join('')}
        </div>
      `;
    }
    else if (wizStep === 3) {
      contentHtml = `
        <p style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">Вам дается 100 динаров на старте. Вы можете записать снаряжение текстом прямо сейчас.</p>
        <textarea id="wzInv" class="textarea-clean" style="height:150px; background:var(--bg-card); border:1px solid var(--border-color); padding:8px;">${wizData.inventory}</textarea>
      `;
    }
    else if (wizStep === 4) {
      contentHtml = `
        <div style="text-align:center; padding:20px;">
          <h2 style="color:var(--accent-gold); font-family:var(--font-heading); margin-bottom:10px;">Всё готово!</h2>
          <p style="margin-bottom:20px; color:var(--text-muted);">Создан персонаж: <strong>${wizData.name}</strong>, раса: ${wizData.race}.<br>Нажмите «Завершить», чтобы применить эти данные к текущему листу.</p>
        </div>
      `;
    }

    body.innerHTML = progressHtml + '<div style="margin-top:16px;">' + contentHtml + '</div>';

    // Hook inputs
    if (wizStep === 0) {
      document.getElementById('wzName').addEventListener('input', e => wizData.name = e.target.value);
      document.getElementById('wzConcept').addEventListener('input', e => wizData.concept = e.target.value);
    } else if (wizStep === 1) {
      document.querySelectorAll('.wz-attr-select').forEach(sel => {
        sel.addEventListener('change', e => {
          wizData.attrs[e.target.getAttribute('data-attr')] = e.target.value;
          // validate exactly d6, d8, d8, d10
          const counts = { d6:0, d8:0, d10:0 };
          Object.values(wizData.attrs).forEach(v => { if(counts[v]!==undefined) counts[v]++; });
          const isValid = counts.d6===1 && counts.d8===2 && counts.d10===1;
          document.getElementById('wzAttrWarn').style.display = isValid ? 'none' : 'block';
          btnNext.disabled = !isValid;
        });
      });
    } else if (wizStep === 2) {
      document.querySelectorAll('.wz-skill-cb').forEach(cb => {
        cb.addEventListener('change', () => {
          const checked = Array.from(document.querySelectorAll('.wz-skill-cb:checked')).map(i => i.value);
          wizData.skills = checked;
        });
      });
    } else if (wizStep === 3) {
      document.getElementById('wzInv').addEventListener('input', e => wizData.inventory = e.target.value);
    }

    btnPrev.style.display = wizStep === 0 ? 'none' : 'block';
    btnNext.textContent = wizStep === 4 ? 'Завершить ✔' : 'Далее ➡';
  }

  window.setWizRace = function(raceName) {
    wizData.race = raceName;
    renderWizardStep();
  };

  document.getElementById('btnWizardPrev').addEventListener('click', () => {
    if (wizStep > 0) { wizStep--; renderWizardStep(); }
  });

  document.getElementById('btnWizardNext').addEventListener('click', () => {
    if (wizStep < 4) { 
      wizStep++; renderWizardStep(); 
    } else {
      // Finish
      const char = getActiveChar();
      char.name = wizData.name;
      char.race = wizData.race;
      char.concept = wizData.concept;
      char.attributes.constitution.die = wizData.attrs.constitution;
      char.attributes.intellect.die = wizData.attrs.intellect;
      char.attributes.empathy.die = wizData.attrs.empathy;
      char.attributes.spirit.die = wizData.attrs.spirit;
      char.skills = wizData.skills.join('\n');
      char.inventory.text = wizData.inventory;
      
      const raceData = GAME_DATA.races.find(r => r.name === wizData.race);
      if (raceData) {
        let addedKm = 0;
        raceData.traits.forEach(t => { if(t.bonusKM) addedKm += t.bonusKM; });
        char.km = addedKm;
      }
      
      saveState();
      renderAll();
      closeModal('wizardModal');
      showToast('Персонаж успешно создан из Мастера!', 'success');
    }
  });

  // ==========================================
  // ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
  // ==========================================
  loadState();
  initGrid();
  renderAll();
});
