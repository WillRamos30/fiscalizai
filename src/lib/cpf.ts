export function isValidCPF(cpf: string): boolean {
  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/[^\d]+/g, '');

  // CPF deve ter 11 dígitos e não pode ser uma sequência repetida (ex: 111.111.111-11)
  if (cleanCPF.length !== 11 || !!cleanCPF.match(/(\d)\1{10}/)) {
    return false;
  }

  const digits = cleanCPF.split('').map(Number);

  // Calcula o primeiro dígito verificador
  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += digits[i] * (10 - i);
  }
  let check1 = (sum1 * 10) % 11;
  if (check1 === 10) check1 = 0;

  if (check1 !== digits[9]) {
    return false;
  }

  // Calcula o segundo dígito verificador
  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += digits[i] * (11 - i);
  }
  let check2 = (sum2 * 10) % 11;
  if (check2 === 10) check2 = 0;

  if (check2 !== digits[10]) {
    return false;
  }

  return true;
}
