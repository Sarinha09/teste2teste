// Configuração do Tailwind CSS
tailwind.config = {
    theme: {
        extend: {
            colors: {
                'brand-dark': '#0a0f18', 'brand-surface': '#111827', 'brand-primary': '#38bdf8',
                'brand-secondary': '#6366f1', 'brand-muted': '#9ca3af',
            },
        },
    },
};

// =========================================================================
// VARIÁVEIS GLOBAIS
// =========================================================================
const requiredColumns = [
   'object_id', 'orbital_period', 'transit_duration', 'transit_depth_ppm',
   'planet_radius', 'stellar_temp', 'stellar_logg', 'stellar_radius'
];
let currentInputMode = 'csv';
let parsedData = [];

// =========================================================================
// DEFINIÇÃO DAS FUNÇÕES
// =========================================================================

// Trocar modo de input csv/manual
function switchInput(mode) {
    currentInputMode = mode;
    const csvArea = document.getElementById('csv-input-area');
    const manualArea = document.getElementById('manual-input-area');
    const btnCsv = document.getElementById('btn-csv');
    const btnManual = document.getElementById('btn-manual');
    if (mode === 'csv') {
        csvArea.style.display = 'block';
        manualArea.style.display = 'none';
        btnCsv.classList.add('bg-brand-primary', 'text-brand-dark', 'font-semibold');
        btnCsv.classList.remove('text-brand-muted');
        btnManual.classList.remove('bg-brand-primary', 'text-brand-dark', 'font-semibold');
    } else {
        csvArea.style.display = 'none';
        manualArea.style.display = 'block';
        btnManual.classList.add('bg-brand-primary', 'text-brand-dark', 'font-semibold');
        btnManual.classList.remove('text-brand-muted');
        btnCsv.classList.remove('bg-brand-primary', 'text-brand-dark', 'font-semibold');
    }
}

//tratamento do arquivo CSV
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        if (!text) return;
        const allLines = text.split(/\r?\n/);
        const validLines = allLines.filter(line => {
            const trimmedLine = line.trim();
            return trimmedLine !== '' && !trimmedLine.startsWith('#');
        });
        if (validLines.length === 0) {
            alert("O arquivo CSV esta vazio de dados");
            return;
        }
        const headerLine = validLines[0];
        const dataLines = validLines.slice(1);
        const delimiter = headerLine.includes(';') ? ';' : ',';
        const headers = headerLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
        const mappingSelects = document.querySelectorAll('.mapping-select');
        mappingSelects.forEach(select => {
            select.innerHTML = '<option value="">Selecionar Coluna</option>';
            headers.forEach(header => {
                const option = document.createElement('option');
                option.value = header;
                option.textContent = header;
                select.appendChild(option);
            });
            const required = select.dataset.required;
            const foundHeader = headers.find(h => h.toLowerCase().replace(/[\s_]+/g, '') === required.toLowerCase().replace(/[\s_]+/g, ''));
            if (foundHeader) select.value = foundHeader;
        });
        parsedData = dataLines.map(line => {
            const values = line.split(delimiter);
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = values[index] ? values[index].trim().replace(/"/g, '') : '';
            });
            return obj;
        });
    };
    reader.readAsText(file);
}

//retorna os dados
function getMappedData() {
    if (currentInputMode === 'manual') {
        const form = document.getElementById('manual-form');
        const formData = new FormData(form);
        const singleEntry = {};
        for(let [key, value] of formData.entries()) {
            if(!value) { alert('Por favor, preencha todos os campos.'); return null; }
            singleEntry[key] = value;
        }
        return [singleEntry];
    }
    if (parsedData.length === 0) { alert('Nenhum dado encontrado no arquivo CSV.'); return null; }
    return parsedData;
}

//analisa dados para fazer mapeamento
function analyzeData() {
    const dataToAnalyze = getMappedData();
    if (!dataToAnalyze) return;
    const mapping = {};
    if (currentInputMode === 'csv') {
        const selects = document.querySelectorAll('.mapping-select');
        let allMapped = true;
        selects.forEach(s => {
            if (!s.value) allMapped = false;
            mapping[s.dataset.required] = s.value;
        });
        if (!allMapped) { alert('Por favor, mapeie todas as colunas obrigatórias.'); return; }
    } else {
        requiredColumns.forEach(col => mapping[col] = col);
    }
    const payload = { data: dataToAnalyze, mapping: mapping };
    const analysisButton = document.querySelector('#data-input button[onclick="analyzeData()"]');
    analysisButton.textContent = 'Analisando...';
    analysisButton.disabled = true;
    fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    .then(response => {
        if (!response.ok) { throw new Error('A resposta da rede não foi OK'); }
        return response.json();
    })
    .then(results => {
        localStorage.setItem('analysisResults', JSON.stringify(results));
        window.location.href = '/results';
    })
    .catch(error => {
        console.error('Erro ao chamar a API:', error);
        alert('Ocorreu um erro ao analisar os dados.');
        analysisButton.textContent = 'Analisar Dados';
        analysisButton.disabled = false;
    });
}

// =========================================================================
// LÓGICA DE INICIALIZAÇÃO DA PÁGINA
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica Geral (roda em todas as páginas) ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('border-gray-800', window.scrollY > 50);
        });
    }
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', () => {
            document.getElementById('mobile-menu').classList.toggle('hidden');
        });
    }

    // --- Lógica da Seção de Entrada de Dados (só roda na index.html) ---
    const dataInputSection = document.getElementById('data-input');
    if (dataInputSection) {
        const columnMappingContainer = document.getElementById('column-mapping');
        requiredColumns.forEach(col => {
            const div = document.createElement('div');
            div.innerHTML = `
                <div class="flex items-center justify-between bg-brand-dark border border-gray-700 p-3 rounded-lg">
                    <label for="map-${col}" class="text-sm font-medium text-brand-muted mr-2">${col.replace(/_/g, ' ')}:</label>
                    <select id="map-${col}" data-required="${col}" class="mapping-select bg-brand-surface border border-gray-600 text-white text-sm rounded-lg p-2 w-1/2 focus:ring-brand-primary focus:border-brand-primary">
                        <option value="">Selecionar Coluna</option>
                    </select>
                </div>`;
            columnMappingContainer.appendChild(div);
        });
        document.getElementById('csv-file-input').addEventListener('change', handleFileSelect);
    }

    // --- Lógica da Seção do Modelo de IA (só roda na index.html) ---
    const aiModelSection = document.getElementById('ai-model');
    if (aiModelSection) {
        const chartTextColor = '#9ca3af';
        // 1. Busca os dados reais da API
        fetch('/model_metrics')
            .then(response => response.json())
            .then(metrics => {
                // Atualiza os textos de Acurácia, Precisão e Recall
                document.getElementById('metric-accuracy').textContent = (metrics.accuracy * 100).toFixed(2);
                document.getElementById('metric-precision').textContent = (metrics.classification_report['weighted avg'].precision * 100).toFixed(2);
                document.getElementById('metric-recall').textContent = (metrics.classification_report['weighted avg'].recall * 100).toFixed(2);

                // 2. CRIA O GRÁFICO DA MATRIZ DE CONFUSÃO APENAS AQUI, com os dados reais
                const ctx = document.getElementById('confusionMatrixChart').getContext('2d');
                const classNames = metrics.class_names;
                const matrixData = metrics.confusion_matrix;
                const datasets = classNames.map((name, index) => {
                    let label = '', color = '';
                    if (name === 'CONFIRMED') { label = 'Predito Confirmado'; color = '#22c55e'; }
                    else if (name === 'CANDIDATE') { label = 'Predito Candidato'; color = '#facc15'; }
                    else { label = 'Predito Falso Positivo'; color = '#ef4444'; }
                    return {
                        label: label,
                        data: [matrixData[0][index], matrixData[1][index], matrixData[2][index]],
                        backgroundColor: color,
                    };
                });

                new Chart(ctx, {
                    type: 'bar',
                    data: { labels: classNames, datasets: datasets },
                    options: {
                        responsive: true,
                        plugins: { legend: { labels: { color: chartTextColor } } },
                        scales: {
                            x: { stacked: true, ticks: { color: chartTextColor }, grid: { color: 'rgba(255,255,255,0.1)' } },
                            y: { stacked: true, ticks: { color: chartTextColor }, title: { display: true, text: 'Real', color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                        }
                    }
                });
            })
            .catch(error => console.error('Erro ao buscar as métricas do modelo:', error));

        // 3. O gráfico de Importância das Features (que é estático) continua sendo criado aqui
        new Chart(document.getElementById('featureImportanceChart'), {
            type: 'bar',
            data: {
                labels: ['Profundidade Trânsito', 'Raio Planeta', 'Período Orbital', 'Raio Estelar', 'Temp. Estelar'],
                datasets: [{
                    label: 'Importância',
                    data: [0.35, 0.25, 0.18, 0.12, 0.1],
                    backgroundColor: ['#38bdf8', '#6366f1', '#38bdf8', '#6366f1', '#38bdf8'],
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: chartTextColor }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    y: { ticks: { color: chartTextColor }, grid: { display: false } }
                }
            }
        });
    }
});