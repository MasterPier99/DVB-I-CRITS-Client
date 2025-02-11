<?php
header("Content-Type: application/json");


if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Metodo non consentito
    echo json_encode(["error" => "Solo le richieste POST sono consentite."]);
    exit;
}


$input = file_get_contents("php://input");
$data = json_decode($input, true);


if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400); // Richiesta non valida
    echo json_encode(["error" => "Payload JSON non valido."]);
    exit;
}

// Verifica che il campo URL sia presente
if (!isset($data['url'])) {
    http_response_code(400); // Richiesta non valida
    echo json_encode(["error" => "Campo 'url' mancante nel payload."]);
    exit;
}




$url = $data['url'];


$response = [
    "status" => "success",
    "message" => "Link ricevuto correttamente.",
    "receivedUrl" => "$url",
];

http_response_code(200);
echo json_encode($response);
