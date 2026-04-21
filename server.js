import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "15mb" }));

const PALM_READING_PROMPT = `あなたはプロの手相占い師です。提供された手のひらの画像を詳しく分析し、日本語で手相鑑定を行ってください。

以下の線を分析してください：
1. **生命線**（いのちせん）: 生命力、健康、活力について
2. **感情線**（かんじょうせん）: 恋愛、感情、対人関係について
3. **頭脳線**（ずのうせん）: 知性、思考パターン、才能について
4. **運命線**（うんめいせん）: 人生の方向性、仕事運、使命について
5. **太陽線**（たいようせん）: 成功、名声、幸運について（見える場合）
6. **結婚線**（けっこんせん）: 恋愛・結婚の傾向について（見える場合）
7. **手全体の形や特徴**: 丘の状態、指の形など

分析結果は以下のJSON形式で返してください：
{
  "overall": "総合的な手相の印象と特徴（2〜3文）",
  "lines": [
    {
      "name": "線の名前",
      "emoji": "関連する絵文字",
      "reading": "その線の詳しい鑑定内容（2〜3文）",
      "luck": 1から5の数値（その分野の運勢の強さ）
    }
  ],
  "fortune": {
    "love": "恋愛運のメッセージ（1〜2文）",
    "work": "仕事運のメッセージ（1〜2文）",
    "health": "健康運のメッセージ（1〜2文）",
    "money": "金運のメッセージ（1〜2文）"
  },
  "advice": "総合的なアドバイスとメッセージ（2〜3文）",
  "lucky": {
    "color": "ラッキーカラー",
    "number": ラッキーナンバー（数値）,
    "direction": "ラッキー方位"
  }
}

手のひらがはっきり見えない場合や画像が手のひらでない場合は、エラーメッセージをJSONで返してください：
{"error": "理由を説明するメッセージ"}

必ずJSONのみを返してください。マークダウンのコードブロックは使わないでください。`;

app.post("/api/analyze", async (req, res) => {
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
              text: PALM_READING_PROMPT,
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
      const raw = textContent.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
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
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`手相占いアプリが起動しました: http://localhost:${PORT}`);
});
