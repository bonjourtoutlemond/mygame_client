#if defined(_WIN32)
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <arpa/inet.h>
#include <cerrno>
#include <cstring>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
#endif

#include <atomic>
#include <chrono>
#include <cctype>
#include <cstdlib>
#include <iostream>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace {

constexpr int kProtocolVersion = 1;
const char* kClientKind = "windows";
const char* kTransport = "tcp";

#if defined(_WIN32)
using socket_t = SOCKET;
constexpr socket_t invalid_socket = INVALID_SOCKET;
constexpr int shutdown_both = SD_BOTH;

bool socket_startup() {
    WSADATA wsa{};
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        std::cerr << "WSAStartup failed: " << WSAGetLastError() << "\n";
        return false;
    }
    return true;
}

void socket_cleanup() {
    WSACleanup();
}

void close_socket(socket_t socket) {
    closesocket(socket);
}

int socket_error() {
    return WSAGetLastError();
}
#else
using socket_t = int;
constexpr socket_t invalid_socket = -1;
constexpr int shutdown_both = SHUT_RDWR;

bool socket_startup() {
    return true;
}

void socket_cleanup() {}

void close_socket(socket_t socket) {
    close(socket);
}

int socket_error() {
    return errno;
}
#endif

std::string trim(const std::string& value) {
    const auto begin = value.find_first_not_of(" \t\r\n");
    if (begin == std::string::npos) {
        return {};
    }
    const auto end = value.find_last_not_of(" \t\r\n");
    return value.substr(begin, end - begin + 1);
}

int parse_int(const char* value, int fallback) {
    if (value == nullptr || *value == '\0') {
        return fallback;
    }
    char* end = nullptr;
    const long parsed = std::strtol(value, &end, 10);
    return end != value ? static_cast<int>(parsed) : fallback;
}

std::string json_escape(const std::string& value) {
    std::string out;
    for (const char ch : value) {
        switch (ch) {
            case '\\': out += "\\\\"; break;
            case '"': out += "\\\""; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                out += static_cast<unsigned char>(ch) < 0x20 ? ' ' : ch;
                break;
        }
    }
    return out;
}

std::string json_string(const std::string& value) {
    return "\"" + json_escape(value) + "\"";
}

std::string get_json_field(const std::string& json, const std::string& key) {
    const std::string needle = "\"" + key + "\"";
    size_t pos = json.find(needle);
    if (pos == std::string::npos) {
        return {};
    }
    pos = json.find(':', pos + needle.size());
    if (pos == std::string::npos) {
        return {};
    }
    ++pos;
    while (pos < json.size() && std::isspace(static_cast<unsigned char>(json[pos]))) {
        ++pos;
    }
    if (pos >= json.size()) {
        return {};
    }

    if (json[pos] == '"') {
        ++pos;
        std::string out;
        while (pos < json.size()) {
            const char ch = json[pos++];
            if (ch == '"') {
                return out;
            }
            if (ch == '\\' && pos < json.size()) {
                const char esc = json[pos++];
                switch (esc) {
                    case '"': out += '"'; break;
                    case '\\': out += '\\'; break;
                    case 'n': out += '\n'; break;
                    case 'r': out += '\r'; break;
                    case 't': out += '\t'; break;
                    default: out += esc; break;
                }
            } else {
                out += ch;
            }
        }
        return out;
    }

    const size_t begin = pos;
    while (pos < json.size() && json[pos] != ',' && json[pos] != '}') {
        ++pos;
    }
    return trim(json.substr(begin, pos - begin));
}

bool send_line(socket_t socket, const std::string& line) {
    std::string wire = line + "\n";
    const char* data = wire.data();
    size_t left = wire.size();
    while (left > 0) {
        const auto n = send(socket, data, left, 0);
        if (n <= 0) {
            return false;
        }
        data += n;
        left -= static_cast<size_t>(n);
    }
    return true;
}

bool recv_line(socket_t socket, std::string& line) {
    line.clear();
    char ch = 0;
    while (true) {
        const auto n = recv(socket, &ch, 1, 0);
        if (n <= 0) {
            return !line.empty();
        }
        if (ch == '\n') {
            return true;
        }
        if (ch != '\r') {
            line.push_back(ch);
        }
    }
}

std::string make_login(const std::string& name) {
    return "{\"version\":" + std::to_string(kProtocolVersion) + ",\"client\":\"" + kClientKind + "\",\"transport\":\"" + kTransport + "\",\"cmd\":\"login\",\"name\":" + json_string(name) + "}";
}

std::string make_list_players(int offset, int limit) {
    std::ostringstream os;
    os << "{\"version\":" << kProtocolVersion << ",\"client\":\"" << kClientKind << "\",\"transport\":\"" << kTransport << "\",\"cmd\":\"list_players\",\"offset\":" << offset << ",\"limit\":" << limit << "}";
    return os.str();
}

std::string make_friend_add(const std::string& target) {
    return "{\"version\":" + std::to_string(kProtocolVersion) + ",\"client\":\"" + kClientKind + "\",\"transport\":\"" + kTransport + "\",\"cmd\":\"friend_add\",\"target\":" + json_string(target) + "}";
}

std::string make_friend_list() {
    return "{\"version\":" + std::to_string(kProtocolVersion) + ",\"client\":\"" + kClientKind + "\",\"transport\":\"" + kTransport + "\",\"cmd\":\"friend_list\"}";
}

std::string make_say(const std::string& target, const std::string& message) {
    return "{\"version\":" + std::to_string(kProtocolVersion) + ",\"client\":\"" + kClientKind + "\",\"transport\":\"" + kTransport + "\",\"cmd\":\"say\",\"target\":" + json_string(target) + ",\"message\":" + json_string(message) + "}";
}

std::string make_exp(int amount) {
    return "{\"version\":" + std::to_string(kProtocolVersion) + ",\"client\":\"" + kClientKind + "\",\"transport\":\"" + kTransport + "\",\"cmd\":\"exp\",\"amount\":" + std::to_string(amount) + "}";
}

std::string make_quit() {
    return "{\"version\":" + std::to_string(kProtocolVersion) + ",\"client\":\"" + kClientKind + "\",\"transport\":\"" + kTransport + "\",\"cmd\":\"quit\"}";
}

void print_help() {
    std::cout
        << "Commands:\n"
        << "  /login <name>\n"
        << "  /players [offset] [limit]\n"
        << "  /add <player>\n"
        << "  /friends\n"
        << "  /say <player> <message>\n"
        << "  /exp <amount>\n"
        << "  /raw <json>\n"
        << "  /quit\n";
}

bool send_interactive(socket_t socket, const std::string& input) {
    if (input.rfind("/login ", 0) == 0) {
        return send_line(socket, make_login(trim(input.substr(7))));
    }
    if (input.rfind("/players", 0) == 0) {
        std::istringstream is(input.substr(8));
        int offset = 0;
        int limit = 10;
        is >> offset >> limit;
        return send_line(socket, make_list_players(offset, limit));
    }
    if (input.rfind("/add ", 0) == 0) {
        return send_line(socket, make_friend_add(trim(input.substr(5))));
    }
    if (input == "/friends") {
        return send_line(socket, make_friend_list());
    }
    if (input.rfind("/say ", 0) == 0) {
        std::istringstream is(input.substr(5));
        std::string target;
        is >> target;
        std::string message;
        std::getline(is, message);
        return send_line(socket, make_say(target, trim(message)));
    }
    if (input.rfind("/exp ", 0) == 0) {
        return send_line(socket, make_exp(parse_int(input.substr(5).c_str(), 10)));
    }
    if (input.rfind("/raw ", 0) == 0) {
        return send_line(socket, trim(input.substr(5)));
    }
    if (input == "/quit") {
        send_line(socket, make_quit());
        return false;
    }
    if (input == "/help") {
        print_help();
        return true;
    }

    std::cout << "Unknown command. Type /help.\n";
    return true;
}

}  // namespace

int main(int argc, char* argv[]) {
    std::string host = "127.0.0.1";
    int port = 5001;
    std::string login;
    bool list_on_start = false;
    std::string add_friend;
    std::string say_target;
    std::string say_message;
    bool quit_after_script = false;

    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "--host" && i + 1 < argc) {
            host = argv[++i];
        } else if (arg == "--port" && i + 1 < argc) {
            port = parse_int(argv[++i], port);
        } else if (arg == "--login" && i + 1 < argc) {
            login = argv[++i];
        } else if (arg == "--list") {
            list_on_start = true;
        } else if (arg == "--add" && i + 1 < argc) {
            add_friend = argv[++i];
        } else if (arg == "--say" && i + 2 < argc) {
            say_target = argv[++i];
            say_message = argv[++i];
        } else if (arg == "--quit-after-script") {
            quit_after_script = true;
        }
    }

    if (!socket_startup()) {
        return 1;
    }

    socket_t socket = ::socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (socket == invalid_socket) {
        std::cerr << "socket failed: " << socket_error() << "\n";
        socket_cleanup();
        return 1;
    }

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(static_cast<u_short>(port));
    if (inet_pton(AF_INET, host.c_str(), &addr.sin_addr) != 1) {
        std::cerr << "Only IPv4 address literals are supported in this tiny demo.\n";
        close_socket(socket);
        socket_cleanup();
        return 1;
    }

    std::cout << "Connecting to " << host << ":" << port << " as protocol v" << kProtocolVersion << " TCP client...\n";
    if (connect(socket, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) != 0) {
        std::cerr << "connect failed: " << socket_error() << "\n";
        close_socket(socket);
        socket_cleanup();
        return 1;
    }

    std::atomic<bool> running{true};
    std::thread receiver([&]() {
        std::string line;
        while (running.load() && recv_line(socket, line)) {
            const std::string type = get_json_field(line, "type");
            if (!type.empty()) {
                std::cout << "\nRX JSON type=" << type << ": " << line << "\n> " << std::flush;
            } else {
                std::cout << "\nRX TEXT: " << line << "\n> " << std::flush;
            }
        }
        running.store(false);
    });

    auto tx = [&](const std::string& json) {
        std::cout << "TX " << json << "\n";
        send_line(socket, json);
        std::this_thread::sleep_for(std::chrono::milliseconds(200));
    };

    if (!login.empty()) {
        tx(make_login(login));
    }
    if (list_on_start) {
        tx(make_list_players(0, 10));
    }
    if (!add_friend.empty()) {
        tx(make_friend_add(add_friend));
        tx(make_friend_list());
    }
    if (!say_target.empty()) {
        tx(make_say(say_target, say_message));
    }
    if (quit_after_script) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
        tx(make_quit());
        running.store(false);
        shutdown(socket, shutdown_both);
    } else {
        print_help();
        std::string input;
        while (running.load()) {
            std::cout << "> " << std::flush;
            if (!std::getline(std::cin, input)) {
                break;
            }
            input = trim(input);
            if (input.empty()) {
                continue;
            }
            if (!send_interactive(socket, input)) {
                break;
            }
        }
        running.store(false);
        shutdown(socket, shutdown_both);
    }

    close_socket(socket);
    if (receiver.joinable()) {
        receiver.join();
    }
    socket_cleanup();
    return 0;
}
