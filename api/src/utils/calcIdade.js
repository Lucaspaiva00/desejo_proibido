export function calcIdade(nascimento) {
    if (!nascimento) return null;

    const hoje = new Date();
    const n = new Date(nascimento);

    let idade = hoje.getFullYear() - n.getFullYear();
    const m = hoje.getMonth() - n.getMonth();

    if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) idade--;
    return idade;
}
