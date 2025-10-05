import pandas as pd
import numpy as np
import joblib
import json
import io
import base64
import matplotlib
import matplotlib.pyplot as plt
from sklearn.tree import plot_tree
from flask import Flask, request, jsonify, render_template
import random

app = Flask(__name__)

try:
    model = joblib.load('exoplanet_model.joblib')
    scaler = joblib.load('scaler.joblib')
    le = joblib.load('label_encoder.joblib')
    print("Modelos carregados com sucesso!")
except FileNotFoundError:
    print("Erro: Arquivos de modelo não encontrados. Execute model.py primeiro.")
    exit()

MODEL_FEATURES = [
    'orbital_period', 'transit_duration', 'transit_depth_ppm',
    'planet_radius', 'stellar_temp', 'stellar_logg', 'stellar_radius'
]


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/guides')
def guias():
    return render_template('guides.html')


@app.route('/results')
def results():
    return render_template('results.html')



@app.route('/predict', methods=['POST'])
def predict():
    json_data = request.get_json()
    if not json_data:
        return jsonify({"error": "Nenhum dado recebido"}), 400

    input_data = json_data.get('data')
    mapping = json_data.get('mapping')

    if not input_data or not mapping:
        return jsonify({"error": "Estrutura de dados inválida"}), 400

    df_raw = pd.DataFrame(input_data)

    # Aplicar o mapeamento de colunas
    df_mapped = pd.DataFrame()
    for model_col, user_col in mapping.items():
        if user_col in df_raw.columns:
            df_mapped[model_col] = df_raw[user_col]

    # Garantir que todas as colunas do modelo existam, na ordem correta
    df_processed = df_mapped.reindex(columns=MODEL_FEATURES)

    for col in df_processed.columns:
        df_processed[col] = pd.to_numeric(df_processed[col], errors='coerce')

    df_processed.fillna(0, inplace=True)


    # Normalizar os dados com o scaler carregado
    X_scaled = scaler.transform(df_processed)

    # Fazer a predição
    predictions_encoded = model.predict(X_scaled)

    # Decodificar os resultados para os nomes originais ('CONFIRMED', etc.)
    predictions = le.inverse_transform(predictions_encoded)
    df_raw['classification'] = predictions

    # Preparar o resultado final
    final_results = df_raw.to_dict(orient='records')

    return jsonify(final_results)


# --- 4. Rota para fornecer as métricas reais do modelo ---
@app.route('/model_metrics')
def model_metrics():
    try:
        with open('model_metrics.json', 'r') as f:
            metrics = json.load(f)
        return jsonify(metrics)
    except FileNotFoundError:
        return jsonify({"error": "Arquivo de métricas não encontrado"}), 404


@app.route('/general_tree_image')
def general_tree_image():
    # Escolhe uma única árvore para visualizar (ex: a primeira)
    estimator = model.estimators_[0]

    fig, ax = plt.subplots(figsize=(20, 10))
    plot_tree(estimator,
              feature_names=MODEL_FEATURES,
              class_names=le.classes_,
              filled=True,
              rounded=True,
              max_depth=4,  # Profundidade limitada para ser legível
              proportion=False,
              precision=2,
              ax=ax,
              fontsize=8)

    buf = io.BytesIO()
    plt.savefig(buf, format='svg', bbox_inches='tight')
    plt.close(fig)

    image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    buf.close()

    return jsonify({'image': f'data:image/svg+xml;base64,{image_base64}'})


# --- Rota ATUALIZADA para o gráfico com CAMINHO DESTACADO ---
@app.route('/decision_path', methods=['POST'])
def decision_path():
    json_data = request.get_json()
    row_data = json_data

    df_row = pd.DataFrame([row_data])
    df_row.replace('', np.nan, inplace=True)

    df_processed = df_row.reindex(columns=MODEL_FEATURES)
    for col in df_processed.columns:
        df_processed[col] = pd.to_numeric(df_processed[col], errors='coerce')
    df_processed.fillna(0, inplace=True)

    X_scaled = scaler.transform(df_processed)

    estimator = model.estimators_[0]

    # --- LÓGICA PARA DESTACAR O CAMINHO ---
    # 1. Obter os nós que os dados percorreram
    node_indicator = estimator.decision_path(X_scaled)
    leaf_id = estimator.apply(X_scaled)
    feature = estimator.tree_.feature
    threshold = estimator.tree_.threshold
    node_index = node_indicator.indices[node_indicator.indptr[0]:node_indicator.indptr[1]]

    # 2. Gerar o gráfico
    fig, ax = plt.subplots(figsize=(25, 20))
    tree_plot = plot_tree(estimator,
                          feature_names=MODEL_FEATURES,
                          class_names=le.classes_,
                          filled=True, rounded=True, ax=ax, fontsize=10)

    # 3. Pintar os nós do caminho
    for node_id in node_index:
        # Se for o nó final (folha), pinte de uma cor diferente
        if leaf_id[0] == node_id:
            tree_plot[node_id].set_arrowstyle("-|>, head_length=1, head_width=0.5")
            tree_plot[node_id].set_facecolor('#38bdf8')  # Azul AstroBit
        else:
            tree_plot[node_id].set_facecolor('#facc15')  # Amarelo Candidato

    buf = io.BytesIO()
    plt.savefig(buf, format='svg', bbox_inches='tight')
    plt.close(fig)

    image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    buf.close()

    return jsonify({'image': f'data:image/svg+xml;base64,{image_base64}'})


@app.route('/random_tree_image')
def random_tree_image():
    try:
        # Pega o número total de árvores (estimadores) no modelo
        num_estimators = len(model.estimators_)
        # Escolhe um índice aleatório para uma das árvores
        random_tree_index = random.randint(0, num_estimators - 1)

        # Seleciona a árvore aleatória do modelo
        estimator = model.estimators_[random_tree_index]

        fig, ax = plt.subplots(figsize=(25, 20))

        # Desenha a árvore de decisão
        plot_tree(estimator,
                  feature_names=MODEL_FEATURES,
                  class_names=le.classes_,
                  filled=True,
                  rounded=True,
                  max_depth=4,  # Manter profundidade limitada para legibilidade
                  proportion=False,
                  precision=2,
                  ax=ax,
                  fontsize=10)

        # Adiciona um título à imagem para que o usuário saiba qual árvore está vendo
        ax.set_title(f"Visualização da Árvore Aleatória #{random_tree_index + 1}", fontsize=20)

        # Salva a imagem em memória
        buf = io.BytesIO()
        plt.savefig(buf, format='svg', bbox_inches='tight')
        plt.close(fig)

        # Converte para base64 e envia como JSON
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        buf.close()

        return jsonify({'image': f'data:image/svg+xml;base64,{image_base64}'})
    except Exception as e:
        print(f"Erro ao gerar árvore aleatória: {e}")
        return jsonify({"error": "Falha ao gerar a imagem da árvore"}), 500

if __name__ == '__main__':
    app.run(debug=True)