#include "common/common.h"

#include <atomic>
#include <chrono>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>

namespace {

bool send_command(demo::TcpStream& stream, std::mutex& send_mutex, const std::string& line) {
    std::lock_guard<std::mutex> guard(send_mutex);
    return demo::send_line(stream, line);
}

void print_help() {
    std::cout
        << "Commands:\n"
        << "  login <name>\n"
        << "  friend add <name>\n"
        << "  friend list\n"
        << "  say <name> <message>\n"
        << "  team <name> <message>\n"
        << "  guild <name> <message>\n"
        << "  exp [amount]\n"
        << "  quit\n";
}

}  // namespace

int main(int argc, char* argv[]) {
    std::string host = "127.0.0.1";
    uint16_t port = 5001;
    std::string login;

    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "--host" && i + 1 < argc) {
            host = argv[++i];
        } else if (arg == "--port" && i + 1 < argc) {
            port = static_cast<uint16_t>(demo::parse_int(argv[++i], port));
        } else if (arg == "--login" && i + 1 < argc) {
            login = argv[++i];
        }
    }

    // TcpStream 内部持有 Boost.Asio tcp::socket。此时 socket 还没有连接到服务器。
    demo::TcpStream stream;
    try {
        // resolver 把命令行传入的 host/port 解析为 endpoint 列表。
        // 这里 host 默认是 127.0.0.1；如果未来传域名，resolver 也能处理。
        demo::Tcp::resolver resolver(demo::sync_io_context());
        // boost::asio::connect 会尝试 resolver 返回的地址，直到建立 TCP 连接。
        // 成功后 stream.socket() 就可以被 send_line/recv_line 用来收发游戏协议文本。
        boost::asio::connect(stream.socket(), resolver.resolve(host, std::to_string(port)));
    } catch (const std::exception& ex) {
        std::cerr << "connect failed: " << ex.what() << "\n";
        return 1;
    }

    std::atomic<bool> running{true};
    std::mutex send_mutex;
    std::thread receiver([&]() {
        std::string line;
        // 接收线程持续从同一个 Asio socket 读取服务器推送。
        // recv_line 会循环 read_some，直到遇到换行符，避免 TCP 拆包/粘包影响上层协议。
        while (running.load() && demo::recv_line(stream, line)) {
            std::cout << "\n" << line << "\n> " << std::flush;
            if (line == "bye") {
                running.store(false);
                break;
            }
        }
        running.store(false);
    });

    if (!login.empty()) {
        send_command(stream, send_mutex, "login " + login);
        std::this_thread::sleep_for(std::chrono::milliseconds(200));
    }

    print_help();
    std::string input;
    while (running.load()) {
        std::cout << "> " << std::flush;
        if (!std::getline(std::cin, input)) {
            break;
        }
        input = demo::trim(input);
        if (input.empty()) {
            continue;
        }
        if (!send_command(stream, send_mutex, input) || input == "quit") {
            break;
        }
    }

    running.store(false);
    stream.close();
    if (receiver.joinable()) {
        receiver.join();
    }
    return 0;
}
