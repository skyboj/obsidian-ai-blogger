
console.log('🚀 ТЕСТ ЗАПУСКА');
console.log('ENV загружен:', npm startprocess.env.TELEGRAM_BOT_TOKEN);
console.log('Пытаемся запустить...');

setTimeout(() => {
  console.log('✅ Тест завершен за 3 секунды');
  process.exit(0);
}, 3000);

