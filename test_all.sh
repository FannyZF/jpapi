#!/bin/bash
# Production API Test Script — 100 cases
# Usage: chmod +x test_all.sh && ./test_all.sh
# Or copy-paste individual curl commands below

BASE="http://101.32.239.62:18933/api/v1"
KEY="YOUR_ADMIN_API_KEY_HERE"
PASS=0
FAIL=0

test_case() {
  local id=$1 method=$2 url=$3 body=$4 expect=$5
  echo -n "[$id/100] $method $url ... "
  
  if [ "$method" = "GET" ]; then
    resp=$(curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $KEY" "$BASE$url" 2>/dev/null)
  else
    resp=$(curl -s -o /dev/null -w "%{http_code}" -X $method -H "X-API-Key: $KEY" -H "Content-Type: application/json" -d "$body" "$BASE$url" 2>/dev/null)
  fi
  
  if [ "$resp" = "200" ] || [ "$resp" = "201" ]; then
    echo "OK ($resp)"
    PASS=$((PASS+1))
  else
    echo "$resp (expected: $expect)"
    FAIL=$((FAIL+1))
  fi
}

echo "============================================"
echo "  API Hub Production Test — 100 Cases"
echo "============================================"
echo ""

# === Health ===
test_case 1 "GET" "/health" "" "200"

# === Classify (25 tests) ===
test_case 2 "POST" "/classify" '{"raw_description":"Laptop Computer"}' "200"
test_case 3 "POST" "/classify" '{"raw_description":"电风扇"}' "200"
test_case 4 "POST" "/classify" '{"raw_description":"SHEIN牌女士纯棉上衣"}' "200"
test_case 5 "POST" "/classify" '{"raw_description":"cotton t-shirt men"}' "200"
test_case 6 "POST" "/classify" '{"raw_description":"不锈钢保温杯"}' "200"
test_case 7 "POST" "/classify" '{"raw_description":"iPhone 15 Pro Max 256GB"}' "200"
test_case 8 "POST" "/classify" '{"raw_description":"Nike篮球鞋"}' "200"
test_case 9 "POST" "/classify" '{"raw_description":"BOSE牌蓝牙耳机"}' "200"
test_case 10 "POST" "/classify" '{"raw_description":"木制餐桌"}' "200"
test_case 11 "POST" "/classify" '{"raw_description":"三文鱼刺身冷冻"}' "200"
test_case 12 "POST" "/classify" '{"raw_description":"Chanel香水50ml"}' "200"
test_case 13 "POST" "/classify" '{"raw_description":"塑料玩具车"}' "200"
test_case 14 "POST" "/classify" '{"raw_description":"运动服套装男款"}' "200"
test_case 15 "POST" "/classify" '{"raw_description":"冰鲜和牛牛排"}' "200"
test_case 16 "POST" "/classify" '{"raw_description":"GUCCI太阳镜"}' "200"
test_case 17 "POST" "/classify" '{"raw_description":"羊毛围巾羊绒"}' "200"
test_case 18 "POST" "/classify" '{"raw_description":"日本产大米5kg"}' "200"
test_case 19 "POST" "/classify" '{"raw_description":"儿童学步车"}' "200"
test_case 20 "POST" "/classify" '{"raw_description":"医用外科口罩"}' "200"
test_case 21 "POST" "/classify" '{"raw_description":"电动自行车"}' "200"
test_case 22 "POST" "/classify" '{"raw_description":""}' "400"
test_case 23 "POST" "/classify" '{"raw_description":"Laptop Computer","hs_code":"84713000"}' "200"
test_case 24 "POST" "/classify" '{"raw_description":"Toy Car","hs_code":"84713000"}' "200"
test_case 25 "POST" "/classify" '{"raw_description":"小米笔记本电脑Intel处理器16G内存1TSSD"}' "200"
test_case 26 "POST" "/classify" '{"raw_description":"USB Cable Type-C 1m"}' "200"

# === Address Cleanse (15 tests) ===
test_case 27 "POST" "/cleanse/address" '{"raw_address":"160-0023 东京都新宿区西新宿2-8-1","provided_zipcode":"160-0023"}' "200"
test_case 28 "POST" "/cleanse/address" '{"raw_address":"4-2-8 Shibakoen Minato-ku Tokyo","provided_zipcode":"105-0011"}' "200"
test_case 29 "POST" "/cleanse/address" '{"raw_address":"大阪府大阪市北区梅田1-1-3","provided_zipcode":"530-0001"}' "200"
test_case 30 "POST" "/cleanse/address" '{"raw_address":"tokyo","provided_zipcode":""}' "400"
test_case 31 "POST" "/cleanse/address" '{"raw_address":"四川省成都市武侯区人民南路四段","provided_zipcode":"610041"}' "200"
test_case 32 "POST" "/cleanse/address" '{"raw_address":"北海道札幌市中央区北3条西4丁目","provided_zipcode":"060-0003"}' "200"
test_case 33 "POST" "/cleanse/address" '{"raw_address":"福冈县福冈市博多区博多駅前2丁目","provided_zipcode":"812-0011"}' "200"
test_case 34 "POST" "/cleanse/address" '{"raw_address":"沖縄県那覇市久茂地1-1-1","provided_zipcode":"900-0015"}' "200"
test_case 35 "POST" "/cleanse/address" '{"raw_address":"名古屋市中区栄3丁目15","provided_zipcode":"460-0008"}' "200"
test_case 36 "POST" "/cleanse/address" '{"raw_address":"京都市中京区河原町通四条上ル","provided_zipcode":"604-0827"}' "200"
test_case 37 "POST" "/cleanse/address" '{"raw_address":"神戸市中央区三宮町1丁目","provided_zipcode":"650-0021"}' "200"
test_case 38 "POST" "/cleanse/address" '{"raw_address":"横浜市中区山下町200","provided_zipcode":"231-0023"}' "200"
test_case 39 "POST" "/cleanse/address" '{"raw_address":"臺北市信義區信義路五段7號","provided_zipcode":"110"}' "200"
test_case 40 "POST" "/cleanse/address" '{"raw_address":"Seoul Jung-gu Myeongdong 1-ga","provided_zipcode":"04536"}' "200"
test_case 41 "POST" "/cleanse/address" '{}' "400"

# === Name Cleanse (15 tests) ===
test_case 42 "POST" "/cleanse/name" '{"raw_name":"山田太郎"}' "200"
test_case 43 "POST" "/cleanse/name" '{"raw_name":"スズキハナコ"}' "200"
test_case 44 "POST" "/cleanse/name" '{"raw_name":"James Smith"}' "200"
test_case 45 "POST" "/cleanse/name" '{"raw_name":"田中 Michael"}' "200"
test_case 46 "POST" "/cleanse/name" '{"raw_name":""}' "400"
test_case 47 "POST" "/cleanse/name" '{"raw_name":"John123"}' "200"
test_case 48 "POST" "/cleanse/name" '{"raw_name":"佐藤 健"}' "200"
test_case 49 "POST" "/cleanse/name" '{"raw_name":"鈴木一郎"}' "200"
test_case 50 "POST" "/cleanse/name" '{"raw_name":"Elon Musk"}' "200"
test_case 51 "POST" "/cleanse/name" '{"raw_name":"高橋　大輔"}' "200"
test_case 52 "POST" "/cleanse/name" '{"raw_name":"张伟"}' "200"
test_case 53 "POST" "/cleanse/name" '{"raw_name":"中村 あゆみ"}' "200"
test_case 54 "POST" "/cleanse/name" '{"raw_name":"김민수"}' "200"
test_case 55 "POST" "/cleanse/name" '{"raw_name":"Nguyễn Văn A"}' "200"
test_case 56 "POST" "/cleanse/name" '{"raw_name":"John Doe Jr."}' "200"

# === Item Cleanse (15 tests) ===
test_case 57 "POST" "/cleanse/item" '{"raw_description":"Laptop Computer","hs_code":"84713000","declared_value_jpy":150000}' "200"
test_case 58 "POST" "/cleanse/item" '{"raw_description":"Cotton T-Shirt","hs_code":"61091000","declared_value_jpy":2000}' "200"
test_case 59 "POST" "/cleanse/item" '{"raw_description":"Lithium Battery Pack","hs_code":"85076000","declared_value_jpy":3000}' "200"
test_case 60 "POST" "/cleanse/item" '{"raw_description":"Fireworks Gift Box","hs_code":"36041000","declared_value_jpy":5000}' "200"
test_case 61 "POST" "/cleanse/item" '{"raw_description":"Toy Car","hs_code":"84713000","declared_value_jpy":1500}' "200"
test_case 62 "POST" "/cleanse/item" '{"raw_description":"Diamond Ring","hs_code":"71131900","declared_value_jpy":50000000}' "200"
test_case 63 "POST" "/cleanse/item" '{"raw_description":"Test","hs_code":"84713000","declared_value_jpy":0}' "400"
test_case 64 "POST" "/cleanse/item" '{"raw_description":"Dog Food Dry","hs_code":"23091000","declared_value_jpy":3000}' "200"
test_case 65 "POST" "/cleanse/item" '{"raw_description":"Leather Handbag","hs_code":"42022100","declared_value_jpy":50000}' "200"
test_case 66 "POST" "/cleanse/item" '{"raw_description":"Wooden Chair","hs_code":"94016100","declared_value_jpy":20000}' "200"
test_case 67 "POST" "/cleanse/item" '{"raw_description":"Wireless Mouse","hs_code":"84716050","declared_value_jpy":3000}' "200"
test_case 68 "POST" "/cleanse/item" '{"raw_description":"Steel Kitchen Knife","hs_code":"82119200","declared_value_jpy":8000}' "200"
test_case 69 "POST" "/cleanse/item" '{"raw_description":"Silk Scarf","hs_code":"62141000","declared_value_jpy":15000}' "200"
test_case 70 "POST" "/cleanse/item" '{"raw_description":"Nintendo Switch","hs_code":"95045000","declared_value_jpy":35000}' "200"
test_case 71 "POST" "/cleanse/item" '{"raw_description":"Vintage Wine 2015","hs_code":"22042100","declared_value_jpy":12000}' "200"

# === Compliance Check (10 tests) ===
test_case 72 "POST" "/compliance/check" '{"items":[{"raw_description":"Laptop","hs_code":"84713000","declared_value_jpy":150000}]}' "200"
test_case 73 "POST" "/compliance/check" '{"items":[{"raw_description":"T-Shirt","hs_code":"61091000","declared_value_jpy":2000},{"raw_description":"Jeans","hs_code":"62034200","declared_value_jpy":5000}]}' "200"
test_case 74 "POST" "/compliance/check" '{"items":[{"raw_description":"Fireworks","hs_code":"36041000","declared_value_jpy":5000}]}' "200"
test_case 75 "POST" "/compliance/check" '{"items":[]}' "400"
test_case 76 "POST" "/compliance/check" '{}' "400"
test_case 77 "POST" "/compliance/check" '{"items":[{"raw_description":"Gold Necklace","hs_code":"71131900","declared_value_jpy":2000000}]}' "200"
test_case 78 "POST" "/compliance/check" '{"items":[{"raw_description":"Fresh Mango","hs_code":"08045000","declared_value_jpy":500}]}' "200"
test_case 79 "POST" "/compliance/check" '{"items":[{"raw_description":"Medicine Aspirin","hs_code":"30049000","declared_value_jpy":2000}]}' "200"
test_case 80 "POST" "/compliance/check" '{"items":[{"raw_description":"Cosmetic Face Cream","hs_code":"33049900","declared_value_jpy":5000}]}' "200"
test_case 81 "POST" "/compliance/check" '{"items":[{"raw_description":"Whisky 700ml","hs_code":"22083000","declared_value_jpy":8000}]}' "200"

# === Classify (more CN products - 19 tests) ===
test_case 82 "POST" "/classify" '{"raw_description":"华为Mate 60 Pro手机"}' "200"
test_case 83 "POST" "/classify" '{"raw_description":"冷冻水饺猪肉白菜"}' "200"
test_case 84 "POST" "/classify" '{"raw_description":"老干妈辣椒酱"}' "200"
test_case 85 "POST" "/classify" '{"raw_description":"普洱茶饼357g"}' "200"
test_case 86 "POST" "/classify" '{"raw_description":"DELL 27英寸显示器"}' "200"
test_case 87 "POST" "/classify" '{"raw_description":"扫地机器人"}' "200"
test_case 88 "POST" "/classify" '{"raw_description":"电动牙刷"}' "200"
test_case 89 "POST" "/classify" '{"raw_description":"婴儿纸尿裤"}' "200"
test_case 90 "POST" "/classify" '{"raw_description":"折叠伞"}' "200"
test_case 91 "POST" "/classify" '{"raw_description":"Panasonic微波炉"}' "200"
test_case 92 "POST" "/classify" '{"raw_description":"Dyson无线吸尘器V15"}' "200"
test_case 93 "POST" "/classify" '{"raw_description":"SK-II护肤精华露230ml"}' "200"
test_case 94 "POST" "/classify" '{"raw_description":"周大福黄金手链999"}' "200"
test_case 95 "POST" "/classify" '{"raw_description":"格力空调遥控器"}' "200"
test_case 96 "POST" "/classify" '{"raw_description":"青岛啤酒500ml罐装"}' "200"
test_case 97 "POST" "/classify" '{"raw_description":"养生堂维生素C片"}' "200"
test_case 98 "POST" "/classify" '{"raw_description":"华为Watch GT智能手表"}' "200"
test_case 99 "POST" "/classify" '{"raw_description":"大疆无人机Mini 4 Pro"}' "200"
test_case 100 "POST" "/classify" '{"raw_description":"索尼PS5游戏主机"}' "200"

echo ""
echo "============================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "============================================"
