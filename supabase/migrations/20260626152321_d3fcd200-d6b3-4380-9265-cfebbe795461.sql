UPDATE public.messages
SET body = CASE
  WHEN raw_message_type = 'image' THEN '🖼️ Imagem recebida'
  WHEN raw_message_type = 'video' THEN '🎥 Vídeo recebido'
  WHEN raw_message_type = 'audio' THEN '🎤 Áudio recebido'
  WHEN raw_message_type = 'voice' THEN '🎤 Mensagem de voz'
  WHEN raw_message_type = 'document' THEN '📎 Documento'
  WHEN raw_message_type = 'sticker' THEN '💟 Figurinha'
  WHEN raw_message_type = 'location' THEN '📍 Localização'
  WHEN raw_message_type = 'contacts' THEN '👤 Contato compartilhado'
  WHEN raw_message_type = 'reaction' THEN '❤️ Reação'
  ELSE '💬 Mensagem recebida (sem texto)'
END
WHERE direction = 'inbound' AND body = '[mensagem sem texto]';