const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');

const app = express();
// Renderは環境変数PORTを使用して、サーバーを起動するポートを指定します
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------
// 🛡️ CORS設定
// ------------------------------------------------------------------
// すべてのオリジンからのアクセスを許可する設定です。
// **本番環境でセキュリティを強化する場合、'*'を特定のドメインに置き換えてください。**
app.use(cors({
    origin: '*', 
    methods: ['GET'],
    optionsSuccessStatus: 204
}));
// ------------------------------------------------------------------


// 📺 ストリーム配信エンドポイント
// GET /stream/:videoid
app.get('/stream/:videoid', async (req, res) => {
    const videoId = req.params.videoid;
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    console.log(`Received request for video ID: ${videoId}`);

    // 1. YouTube IDの検証
    if (!ytdl.validateID(videoId)) {
        console.log(`Validation failed for ID: ${videoId}`);
        return res.status(400).send({ error: 'Invalid YouTube Video ID' });
    }

    try {
        // 2. 動画情報の取得とフォーマットの選択
        // 最高の品質の動画（音声と映像の両方を含む）フォーマットを選択します
        const info = await ytdl.getInfo(youtubeUrl);
        const format = ytdl.chooseFormat(info.formats, { 
            quality: 'highest', // 通常、最高の品質を選択
            filter: 'audioandvideo' 
        });

        if (!format) {
            console.error('No suitable audio/video format found.');
            return res.status(500).send({ error: 'No suitable streaming format found.' });
        }
        
        // 3. レスポンスヘッダーの設定
        // ブラウザが動画として認識するためのヘッダー
        res.header('Content-Type', 'video/mp4'); // 一般的な動画MIMEタイプ
        // Content-Dispositionを設定すると、ブラウザがダウンロードを提案します（ここではストリーミングのため除外）
        
        // 4. ストリームのパイプ
        // YouTubeから取得したストリームを直接クライアントのレスポンスに流し込みます
        console.log(`Streaming format found. Pipelining stream.`);
        ytdl(youtubeUrl, { format: format, highWaterMark: 1024 * 1024 * 10 }) // バッファサイズを調整
            .on('error', (err) => {
                console.error('Error in ytdl stream:', err);
                // ストリームエラーが発生した場合、レスポンスを終了
                if (!res.headersSent) {
                    res.status(500).send({ error: 'Stream processing error' });
                } else {
                    res.end();
                }
            })
            .pipe(res);

    } catch (error) {
        console.error('An unexpected error occurred:', error.message);
        // エラーレスポンスを送信
        if (!res.headersSent) {
            res.status(500).send({ error: `Server error: ${error.message}` });
        }
    }
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Access endpoint: /stream/:videoid`);
});
