<?php
// Development router for PHP CLI. REQUEST_URI stays intact for front controllers.
$root = realpath(getenv('LIVE_SERVER_SE_ROOT'));
$uri = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
if (strpos($uri, "\0") !== false || strpos($uri, '\\') !== false || preg_match('~(^|/)(\.[^/]*|node_modules|vendor)(/|$)~', $uri)) { http_response_code(403); exit('Forbidden'); }
$file = realpath($root . $uri);
if ($file && is_dir($file)) {
    foreach (['index.php', 'index.html'] as $index) {
        if (is_file($file . '/' . $index)) { $file = realpath($file . '/' . $index); break; }
    }
}
if (!$file || !is_file($file)) $file = realpath($root . '/index.php');
if (!$file || !is_file($file)) { http_response_code(404); exit('404 — File not found'); }
if (strpos($file, $root . DIRECTORY_SEPARATOR) !== 0) { http_response_code(403); exit('Forbidden'); }
$extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
if (in_array($extension, ['inc', 'phar'])) { http_response_code(403); exit('Forbidden'); }
if (in_array($extension, ['php', 'phtml'])) {
    $_SERVER['SCRIPT_FILENAME'] = $file;
    $_SERVER['SCRIPT_NAME'] = str_replace(DIRECTORY_SEPARATOR, '/', substr($file, strlen($root)));
    $_SERVER['PHP_SELF'] = $_SERVER['SCRIPT_NAME'];
    $_SERVER['DOCUMENT_ROOT'] = $root;
    chdir(dirname($file));
    require $file;
    return true;
}
return false;
