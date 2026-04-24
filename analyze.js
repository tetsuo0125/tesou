import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const PALM_READING_PROMPT = `あなたは、東洋と西洋の両方の手相術（パーム・リーディング）に精通した、世界最高峰の熟練手相鑑定士です。
提供された手のひらの画像を細部まで「識別」し、論理的な「判断」を行ってください。

以下のプロセスで分析を行ってください：
1. **識別のフェーズ**: 各主要な線（生命線、感情線、知性線、運命線など）がどこから始まり、どの丘（木星丘、土星丘、太陽丘、水星丘など）に向かって伸びているか、その長さ、太さ、形状（鎖状、断裂、分岐の有無）を正確に特定してください。
2. **判断のフェーズ**: 識別の結果に基づき、その人の性格、運位、健康、将来の可能性を独自の洞察をもって鑑定してください。

分析対象：
- **主要四線**: 生命線（活力）、知性線（才能・思考）、感情線（感情・愛情）、運命線（社会的運勢）
- **補助線**: 太陽線（成功）、結婚線、直感線、財運線など（見える場合）
- **丘の盛り上がり**: 木星丘、土星丘、太陽丘、水星丘、金星丘、月丘の状態
- **特殊紋**: フィッシュ、スター、十字線など（見える場合）

分析結果は以下のJSON形式で返してください。マークダウンのコードブロックは使わず、純粋なJSONのみを返してください。：
{
  "identification": "識別された特徴の技術的な説明（例：生命線が長く、金星丘が発達しているなど）",
  "overall": "総合的な鑑定結果の要約",
  "lines": [
    {
      "name": "線の名前",
      "emoji": "絵文字",
      "reading": "詳しい鑑定内容",
      "luck": 5,
      "points": [[x,y], [x,y], [x,y], [x,y], [x,y]]
    }
  ],
  "fortune": {
    "love": "恋愛運",
    "work": "仕事運",
    "health": "健康運",
    "money": "金運"
  },
  "advice": "アドバイス",
  "lucky": {
    "color": "カラー",
    "number": 7,
    "direction": "方位"
  }
}

各線の points は、画像の左上を (0,0)、右下を (100,100) とした相対座標で、その線の軌跡を5点以上の配列で表現してください。これにより、どの線を識別したか可視化します。

もし画像が手のひらとして不鮮明、または手のひらではない場合は、以下を返してください：
{"error": "手のひらがはっきりと確認できません。明るい場所で、指を軽く開き、手のひら全体が写るように撮り直してください。"}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let imageData;
    let mediaType;

    if (req.body.image) {
      const matches = req.body.image.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ error: "無効な画像データです" });
      }
      mediaType = matches[1];
      imageData = matches[2];
    } else {
      return res.status(400).json({ error: "画像が見つかりません" });
    }

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mediaType)) {
      return res.status(400).json({ error: "JPEG、PNG、WebP形式の画像をアップロードしてください" });
    }

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: PALM_READING_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageData,
              },
            },
            {
              type: "text",
              text: "この手のひらを鑑定してください。",
            },
          ],
        },
      ],
    });

    const textContent = response.content.find((b) => b.type === "text");
    if (!textContent) {
      return res.status(500).json({ error: "鑑定結果を取得できませんでした" });
    }

    let result;
    try {
      const raw = textContent.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      result = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "鑑定結果の解析に失敗しました" });
    }

    res.json(result);
  } catch (err) {
    console.error("Error:", err);
    if (err instanceof Anthropic.APIError) {
      return res.status(err.status || 500).json({ error: `APIエラー: ${err.message}` });
    }
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
}
