#!/bin/bash
# 一键部署脚本（适配1Panel环境）
# 用法: ./deploy.sh [frontend|backend|all]

SERVER="root@110.42.61.245"
PROJECT_DIR="/Users/zhanglin/Documents/xitongkaifa"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_DIR="$PROJECT_DIR/backend"

# 1Panel目录配置
REMOTE_FRONTEND="/www/sites/docs.zxiaolin.com/index"
REMOTE_BACKEND="/root/yujian-vied/backend"

MODE=${1:-all}

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo_success() { echo -e "${GREEN}[OK]${NC} $1"; }
echo_info()    { echo -e "${YELLOW}[..]${NC} $1"; }
echo_error()   { echo -e "${RED}[!!]${NC} $1"; }

# 检查SSH连接
check_ssh() {
    echo_info "检查服务器连接..."
    if ssh -o ConnectTimeout=5 $SERVER "echo ok" > /dev/null 2>&1; then
        echo_success "服务器连接正常"
    else
        echo_error "无法连接服务器，请检查SSH配置"
        exit 1
    fi
}

# 部署前端（1Panel网站模式）
deploy_frontend() {
    echo ""
    echo "========================================="
    echo "       部署前端"
    echo "========================================="

    echo_info "构建前端项目..."
    cd $FRONTEND_DIR
    npm run build
    if [ $? -ne 0 ]; then
        echo_error "前端构建失败！"
        exit 1
    fi
    echo_success "前端构建完成"

    echo_info "上传前端文件到1Panel网站目录..."
    # 先清空旧文件，避免残留
    ssh $SERVER "rm -rf $REMOTE_FRONTEND/*"
    scp -r dist/* $SERVER:$REMOTE_FRONTEND/
    if [ $? -ne 0 ]; then
        echo_error "前端文件上传失败！"
        exit 1
    fi
    echo_success "前端部署完成（1Panel网站自动生效，无需重启）"
}

# 部署后端（1Panel运行环境模式）
deploy_backend() {
    echo ""
    echo "========================================="
    echo "       部署后端"
    echo "========================================="

    echo_info "上传后端代码到服务器..."
    # 排除 node_modules 和 data 目录，避免覆盖服务器上的依赖和数据库
    rsync -avz --delete \
        --exclude='node_modules' \
        --exclude='data' \
        --exclude='data.db' \
        --exclude='data.db-shm' \
        --exclude='data.db-wal' \
        --exclude='logs' \
        --exclude='uploads' \
        --exclude='.env' \
        --exclude='.jwt_secret' \
        --exclude='.npm-cache' \
        --exclude='.node-gyp' \
        --exclude='test' \
        --exclude='.DS_Store' \
        $BACKEND_DIR/ $SERVER:$REMOTE_BACKEND/
    if [ $? -ne 0 ]; then
        echo_error "后端代码上传失败！"
        exit 1
    fi
    echo_success "后端代码上传完成"

    echo_info "在服务器上安装依赖..."
    ssh $SERVER "cd $REMOTE_BACKEND && npm install --production 2>&1 | tail -5"
    if [ $? -ne 0 ]; then
        echo_error "依赖安装失败！"
        exit 1
    fi
    echo_success "依赖安装完成"

    echo ""
    echo_info "=========================================="
    echo_info "  请在1Panel中重启后端服务："
    echo_info "  1Panel → 运行环境 → Node.js → 重启"
    echo_info "=========================================="
    echo ""
    echo -n "已重启？(y/n): "
    read RESTARTED
    if [ "$RESTARTED" = "y" ]; then
        echo_success "后端服务已重启"
    else
        echo_info "请稍后手动重启后端服务"
    fi
}

# 验证部署
verify() {
    echo ""
    echo "========================================="
    echo "       验证部署"
    echo "========================================="

    echo_info "检查后端API..."
    API_RESULT=$(ssh $SERVER "curl -s -o /dev/null -w '%{http_code}' http://localhost:3010/api/health" 2>/dev/null)
    if [ "$API_RESULT" = "200" ]; then
        echo_success "后端API正常 (HTTP $API_RESULT)"
    else
        echo_error "后端API异常 (HTTP $API_RESULT)，请确认已在1Panel中重启"
    fi

    echo_info "检查前端页面..."
    FRONTEND_RESULT=$(ssh $SERVER "curl -s -o /dev/null -w '%{http_code}' https://docs.zxiaolin.com/" 2>/dev/null)
    if [ "$FRONTEND_RESULT" = "200" ]; then
        echo_success "前端页面正常 (HTTP $FRONTEND_RESULT)"
    else
        echo_error "前端页面异常 (HTTP $FRONTEND_RESULT)"
    fi
}

# 主流程
echo ""
echo "========================================="
echo "   一键部署 - $MODE"
echo "   服务器: $SERVER"
echo "========================================="

check_ssh

case $MODE in
    frontend)
        deploy_frontend
        ;;
    backend)
        deploy_backend
        ;;
    all)
        deploy_frontend
        deploy_backend
        ;;
    *)
        echo "用法: ./deploy.sh [frontend|backend|all]"
        echo "  frontend - 只部署前端"
        echo "  backend  - 只部署后端"
        echo "  all      - 部署前后端（默认）"
        exit 1
        ;;
esac

verify

echo ""
echo "========================================="
echo -e "${GREEN}   部署完成！${NC}"
echo "   前端: https://docs.zxiaolin.com/"
echo "   后端: https://docs.zxiaolin.com/api/health"
echo "========================================="
