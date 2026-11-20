<p align="center">
  <img src="icons/128.png" alt="PixelScope Logo" width="128">
</p>

<div align="center">
  <h1>PixelScope</h1>
  <p>🇬🇧 <a href="README.md">English</a> · 🇹🇷 Türkçe</p>
  <p>Sağ tık engelini kaldıran, sayfadaki tüm görselleri bulup listeleyen ve görsellerin <strong>orijinal çözünürlüklü</strong> sürümünü bulmaya çalışan tarayıcı eklentisi (Manifest V3, Chromium tabanlı tarayıcılar).</p>
</div>

## Özellikler

- **Engel kaldırma:** Sağ tık, metin seçimi, sürükleme, kopyalama ve kesme engellerini kaldırır. Popup'tan açılıp kapatılır, ayar tüm sitelerde ve sekmelerde kalıcıdır.
- **Görsel sağ tık menüsü:** Sağ tık engeli olan sitelerde bile görselin üstünde çalışır.
  - Görseli yeni sekmede aç / kaydet / kopyala
  - Orijinal görseli yeni sekmede aç / kaydet / kopyala
- **Görsel tarayıcı:** Sayfadaki tüm görselleri bulur ve ızgara olarak listeler. Url veya türe göre filtrelenebilir. Tarama şunları kapsar:
  - `<img>`, `srcset`, `<picture>/<source>` ve lazy-load (`data-*`) öznitelikleri
  - CSS `background-image` (`::before` / `::after` dahil)
  - Inline SVG, `<canvas>`, video `poster`
  - `og:image`, `twitter:image`, favicon ve `apple-touch-icon`
  - Tüm iframe'ler
- **Orijinali bul:** URL üzerinde sezgisel dönüşümler dener ve yalnızca mevcut sürümden **daha büyük** çıkan adresleri çözünürlükleriyle birlikte listeler.
- **Detay paneli:** Önizleme, boyut, tür, URL kopyalama, yeni sekmede açma ve indirme.

## Orijinal sürüm nasıl bulunuyor?

Bir yapay zekâ veya sunucu tarafı işlem yok; adres kalıpları denenir ve her aday gerçekten yüklenip piksel sayısı karşılaştırılır:

| Kalıp | Örnek |
|---|---|
| Boyut/kalite parametrelerini silme | `?w=300&q=60` → parametresiz |
| WordPress | `foto-300x200.jpg` / `foto-scaled.jpg` → `foto.jpg` |
| Küçük resim son ekleri | `_thumb`, `_small`, `_medium` vb. |
| Shopify | `foto_300x.jpg` → `foto.jpg` |
| Yol segmentleri | `/thumbs/`, `/small/` → `/original/`, `/large/` |
| Cloudinary benzeri | `/upload/w_300,c_fill/` → `/upload/` |
| Google | `=s200`, `=w300-h200` → `=s0` |
| Twitter/X | `name=small` → `name=orig` |
| `@2x` son eki | `foto@2x.png` → `foto.png` |
| `srcset` | Sayfadaki aynı dosya adına sahip daha büyük adaylar |

> Sonuç siteye bağlıdır. Bu bir tahmin yöntemidir, her zaman daha büyük sürüm bulunamayabilir.

## Dil

Arayüz Türkçe ve İngilizce desteklenir. Tarayıcı dili Türkçe ise eklenti Türkçe, aksi halde (varsayılan) İngilizce açılır. Metinler `_locales/` klasöründedir.

## Kurulum

Eklenti henüz mağazada yayınlanmadı; Chrome, Edge, Brave gibi Chromium tabanlı tarayıcılarda geliştirici modunda yüklenir.

1. Bu depoyu indir veya klonla:
   ```bash
   git clone https://github.com/sametdurn/PixelScope.git
   ```
2. `chrome://extensions` adresini aç.
3. Sağ üstten **Geliştirici modu**'nu etkinleştir.
4. **Paketlenmemiş öğe yükle** ile `PixelScope` klasörünü seç.

## Kullanım

1. **Engeli kaldırmak için:** Araç çubuğundaki PixelScope simgesine tıkla ve *Sağ tık / seçim / sürükleme engelini kaldır* kutusunu işaretle.
2. **Tek bir görseli almak için:** Görselin üzerine sağ tıkla ve PixelScope menüsünden istediğin işlemi seç.
3. **Sayfadaki tüm görselleri görmek için:** Popup'ta **Görselleri Tara**'ya bas, bir görsele tıkla, **Orijinali bul** ile daha büyük sürümü ara.

## İzinler

| İzin | Neden gerekli |
|---|---|
| `activeTab`, `scripting` | Sayfayı taramak ve bildirim göstermek |
| `contextMenus` | Sağ tık menüsü öğeleri |
| `downloads` | Görselleri indirmek |
| `clipboardWrite` | Görseli panoya kopyalamak |
| `storage` | Engel kaldırma ayarını saklamak |
| `<all_urls>` | Tüm sitelerde çalışabilmek |

Veri toplanmaz ve hiçbir sunucuya gönderilmez. Tüm işlemler tarayıcı içinde yerel olarak yapılır.

## Proje yapısı

```
PixelScope/
├── manifest.json      # Eklenti tanımı (MV3)
├── background.js      # Sağ tık menüsü, indirme, kopyalama
├── content-main.js    # Sayfa dünyasında engelleri kırar (MAIN world)
├── content.js         # Görsel tespiti, orijinal bulma, mesajlaşma
├── popup.html/.css/.js# Arayüz: tarayıcı, filtre, detay paneli
├── viewer.html/.js    # data: görsellerini yeni sekmede göstermek için
├── _locales/          # en (varsayılan) ve tr çeviri dosyaları
└── icons/             # 16, 32, 48, 128 px simgeler
```

## Sorumluluk reddi

Bu araç yalnızca kişisel kullanım ve erişilebilirlik içindir. İndirdiğin görsellerin telif haklarına ve sitelerin kullanım koşullarına uymak senin sorumluluğundadır.

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.
