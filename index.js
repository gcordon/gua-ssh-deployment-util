const yargs = require(`yargs`)
const fs = require(`fs`)
const { Client } = require(`ssh2`)
const path = require(`path`)
const { execSync } = require("child_process")
require('dotenv').config()

//    h5    或      webview
const Project_Env = new Map()
Project_Env.set('webview', {
    // SSH连接配置
    sshConfig: {
        port: process.env.SSH_PORT,
        host: process.env.SSH_HOST,
        username: process.env.SSH_USERNAME,
        password: process.env.SSH_PASSWORD,
    },
    //  本地目录
    localhostDirname: process.env.SSH_LOCAL_HOST_DIRNAME,
    // 服务器目录
    serverDirname: `/webview_vue`, // path.resolve(`../`)
})

const {
    sshConfig,
    localhostDirname,
    serverDirname,
} = Project_Env.get('webview')

// 查询本地最新的zip文件
const onLocalSerach = () => {
    try {
        // let e = execSync(
        //     `ls -lt ../*.zip | head -1 | awk '{print $NF}' | xargs basename`
        // )
        let e = execSync(
            `ls -lt ${localhostDirname}/*.zip | head -1 | awk '{print $NF}' | xargs basename`
        )
        e = e.toString().trim()
        return e
    } catch (error) {
        console.error(`查询最新zip ERROR: ${error}`)
    }
}

const __main = () => {
    // 定义命令行参数
    const argv = yargs
        .option(`p`, {
            alias: `s`,
            description: `项目名 h5 ||  webview`,
            type: `string`,
        })
        .option(`u`, {
            alias: `n`,
            description: `服务器 username`,
            type: `string`,
            // demandOption: true, // 是否必需的参数
        })
        .option(`p`, {
            alias: `a`,
            description: `服务器 password`,
            type: `string`,
            // default: 18 // 默认值
        })
        .option(`z`, {
            alias: `z`,
            description: `上传的zip`,
            type: `string`,
        })
        .option(`r`, {
            alias: `r`,
            description: `回滚的zip`,
            type: `string`,
        })
        .option(`s`, {
            alias: `s`,
            description: `查询所有的zip`,
            type: `string`,
        })
        .help().argv // 自动生成帮助信息

    // 获取命令行参数值
    const sUsername = argv.u
    const sPassword = argv.p
    const sZip = argv.z
    const sRealoadZip = argv.r
    const sSearchAllZip = argv.s

    // 打印命令行参数
    console.log(`sUsername: ${sUsername}`)
    console.log(`sPassword: ${sPassword}`)
    console.log(`sZip     : ${sZip}`)
    console.log(`sRealoadZip     : ${sRealoadZip}`)
    console.log(`sSearchAllZip     : ${sSearchAllZip}`)


    let zipName = onLocalSerach() // 默认查询当前最新的zip文件名
    if (sZip) {
        zipName = sZip
    }

    // 本地ZIP文件路径
    const localFilePath = `${localhostDirname}/${zipName}`
    // 远程服务器目标路径
    const remoteFilePath = `${serverDirname}/${zipName}`
    console.log(`\n`)
    console.log(`🌹🌹  默认上传: \n🌹🌹`)
    console.log(`🌹🌹  本地ZIP文件路径: \n${localFilePath} \n🌹🌹`)
    console.log(`🌹🌹  远程ZIP文件路径: \n${remoteFilePath}\n🌹🌹`)
    console.log(`🌹🌹  默认上传: \n🌹🌹`)
    console.log(`\n`)

    // 创建SSH连接
    const sshClient = new Client()
    sshClient.on(`ready`, () => {
        console.log(`SSH连接已建立`)
        readedLinkCallback()
    })
    sshClient.on(`error`, (err) => {
        console.error(`SSH连接错误:`, err)
    })
    sshClient.connect(sshConfig)

    const readedLinkCallback = async () => {
        if (sSearchAllZip !== undefined) {
            await onServerAllZip()
        } else if (sRealoadZip) {
            await onUnzip(sRealoadZip)
        } else {
            await onUploadZIP()
            await onUnzip()
        }
        closeSSHLink()

        // 移除当前目录下所有的zip文件 (服务器和本地都可以使用这条命令)
        // sshClient.exec(`find . -maxdepth 1 -type f -name "*.zip" -delete`)
    }


    // 解压文件 （new || reload）
    const onUnzip = (newZipName) => {
        return new Promise((resolve, reject) => {
            let z = zipName
            if (newZipName) {
                z = newZipName
            }
            // TODO: 注意解压的目录需要有权限 chmod -R +w /webview_vue/dist
            sshClient.exec(
                `unzip -o ${serverDirname}/${z} -d ${serverDirname}`,
                (err, stream) => {
                    if (err) {
                        throw err
                    }
                    stream
                        .on(`close`, (code, signal) => {
                            console.log(`🌹🌹  Unzip command completed. 🌹🌹  `)
                            resolve(remoteFilePath)
                        })
                        .on(`data`, (data) => {
                            // console.log(`Unzip command Output.`, data.toString())
                        })
                        .stderr.on(`data`, (data) => {
                            console.log(`Unzip command Error.`, data.toString())
                            closeSSHLink()
                            reject(err)
                        })
                }
            )
        })
    }

    // 上传
    const onUploadZIP = () => {
        return new Promise((resolve, reject) => {
            console.log(`老哥，文件上传中.....`)
            // 上传ZIP文件
            sshClient.sftp((err, sftp) => {
                if (err) {
                    console.error(`SFTP错误:`, err)
                    closeSSHLink()
                    reject(err)
                    return
                }

                const readStream = fs.createReadStream(localFilePath)
                const writeStream = sftp.createWriteStream(remoteFilePath)

                // 开始文件传输
                writeStream.on(`close`, () => {
                    console.log(`文件上传完成`, remoteFilePath)
                    resolve(remoteFilePath)
                })

                // 处理传输错误
                writeStream.on(`error`, (err) => {
                    console.error(`文件上传错误:`, err)
                    closeSSHLink()
                    reject(err)
                })

                // 执行文件传输
                readStream.pipe(writeStream)
            })
        })
    }

    const onServerAllZip = () => {
        return new Promise((resolve, reject) => {
            let nm = `find ${serverDirname} -maxdepth 1 -type f -name "*.zip" -printf "%f\n"`
            sshClient.exec(
                nm,
                (err, stream) => {
                    stream
                        .on("close", (err) => {
                            console.log(`🚀 ~ stream.on ~ err:`, err)
                            closeSSHLink()
                            reject(err)
                        })
                        .on("data", (data) => {
                            let e = data.toString()
                            console.log(`🌹🌹  查询服务器下所有的zip包. 🌹🌹  `)
                            console.log(e.split('\n'))
                            console.log(`🌹🌹  查询服务器下所有的zip包. 🌹🌹  `)
                            resolve()
                        })
                }
            )
        })
    }

    // 断开ssh链接
    const closeSSHLink = () => {
        console.log(`老哥，我断开了.....`)
        sshClient.end()
    }
}

__main()