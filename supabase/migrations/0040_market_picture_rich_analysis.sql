-- market_picture tablosuna zengin analiz için yeni kolonlar ekle.
-- previous_summary: bir sonraki AI çağrısına devamlılık bağlamı sağlar.
-- facts kolon zaten var ama emtia/FX verileri de içerecek şekilde genişletildi
-- (facts JSON alanı olduğu için şema değişikliği gerekmez, sadece içerik genişler).

ALTER TABLE market_picture
  ADD COLUMN IF NOT EXISTS previous_summary text;
