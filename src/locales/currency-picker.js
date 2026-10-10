const NAMES = [
  ["USD", "US dollar", "美元", "米ドル", "미국 달러", "Dollar américain", "Dólar estadounidense"],
  ["CNY", "Chinese yuan", "人民币", "人民元", "중국 위안", "Yuan chinois", "Yuan chino"],
  ["EUR", "Euro", "欧元", "ユーロ", "유로", "Euro", "Euro"],
  ["GBP", "Pound sterling", "英镑", "英ポンド", "영국 파운드", "Livre sterling", "Libra esterlina"],
  ["JPY", "Japanese yen", "日元", "日本円", "일본 엔", "Yen japonais", "Yen japonés"],
  ["HKD", "Hong Kong dollar", "港元", "香港ドル", "홍콩 달러", "Dollar de Hong Kong", "Dólar de Hong Kong"],
  ["TWD", "New Taiwan dollar", "新台币", "新台湾ドル", "신타이완 달러", "Nouveau dollar taïwanais", "Nuevo dólar taiwanés"],
  ["KRW", "South Korean won", "韩元", "韓国ウォン", "대한민국 원", "Won sud-coréen", "Won surcoreano"],
  ["SGD", "Singapore dollar", "新加坡元", "シンガポールドル", "싱가포르 달러", "Dollar de Singapour", "Dólar de Singapur"],
  ["AUD", "Australian dollar", "澳元", "豪ドル", "호주 달러", "Dollar australien", "Dólar australiano"],
  ["CAD", "Canadian dollar", "加拿大元", "カナダドル", "캐나다 달러", "Dollar canadien", "Dólar canadiense"],
  ["NZD", "New Zealand dollar", "新西兰元", "ニュージーランドドル", "뉴질랜드 달러", "Dollar néo-zélandais", "Dólar neozelandés"],
  ["CHF", "Swiss franc", "瑞士法郎", "スイスフラン", "스위스 프랑", "Franc suisse", "Franco suizo"],
  ["INR", "Indian rupee", "印度卢比", "インドルピー", "인도 루피", "Roupie indienne", "Rupia india"],
  ["BRL", "Brazilian real", "巴西雷亚尔", "ブラジルレアル", "브라질 헤알", "Réal brésilien", "Real brasileño"],
];

export const COMMON_CURRENCIES = NAMES.map(([code, ...names]) => ({
  code,
  names: Object.fromEntries(["en", "zh", "ja", "ko", "fr", "es"].map((lang, index) => [lang, names[index]])),
}));

export const CURRENCY_PICKER_COPY = {
  choose: ["Choose currency", { zh: "选择币种", ja: "通貨を選択", ko: "통화 선택", fr: "Choisir une devise", es: "Elegir moneda" }],
  custom: ["Custom currency", { zh: "自定义币种", ja: "通貨コードを指定", ko: "직접 통화 지정", fr: "Autre devise", es: "Otra moneda" }],
  code: ["Currency code", { zh: "币种代码", ja: "通貨コード", ko: "통화 코드", fr: "Code de devise", es: "Código de moneda" }],
  use: ["Use currency code", { zh: "选择此代码", ja: "このコードを選択", ko: "이 코드 선택", fr: "Utiliser ce code", es: "Usar este código" }],
  help: ["Enter a three-letter currency code, e.g. SEK.", {
    zh: "输入三位字母的币种代码，例如 SEK。",
    ja: "SEK など、3 文字の通貨コードを入力してください。",
    ko: "SEK와 같은 세 글자의 통화 코드를 입력하세요.",
    fr: "Saisissez un code de devise à trois lettres, par exemple SEK.",
    es: "Introduce un código de moneda de tres letras, por ejemplo SEK.",
  }],
};
