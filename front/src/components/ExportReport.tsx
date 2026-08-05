"use client";

import { exportStudentReportXlsx } from "@/lib/exportStudentReport";
import { useEffect, useState, useRef } from "react";
import Link from 'next/link';

type ExportReportProps = {
    email: string | null;
    nome: string | null;
}

export default function ExportReport({ email, nome }: ExportReportProps) {
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [errorMessage, setErrorMessage] = useState('');
    const effectRan = useRef(false);

    useEffect(() => {
        if (effectRan.current === true && process.env.NODE_ENV === 'development') {
            return;
        }

        const generateReport = async () => {
            if (!email) {
                setErrorMessage("E-mail do estudante não fornecido. Não é possível exportar.");
                setStatus('error');
                return;
            }

            try {
                const result = await exportStudentReportXlsx(email);

                if (result === 'empty') {
                    setErrorMessage("Não foram encontrados dados de relatório para este estudante.");
                    setStatus('error');
                    return;
                }

                setStatus('success');
            } catch (error) {
                console.error("Erro ao gerar relatório:", error);
                setErrorMessage("Ocorreu um erro inesperado ao gerar o relatório.");
                setStatus('error');
            }
        };

        generateReport();

        return () => {
            effectRan.current = true;
        };

    }, [email]);

    if (status === 'processing') {
        return (
            <div className="p-6 text-center">
                <p className="text-lg font-medium">Gerando relatório, por favor aguarde...</p>
                <p className="text-gray-600">O download começará em breve.</p>
            </div>
        );
    }
    if (status === 'success') {
        return (
            <div className="p-6 text-center">
                <h2 className="text-xl font-bold text-green-700">Relatório Gerado com Sucesso!</h2>
                <p className="text-gray-600 mt-2">O download do arquivo Excel deve ter começado.</p>
                <Link href={`/estudantes/visualizar?email=${email}&nome=${nome}`} className="br-button primary mt-6 inline-block">
                    Voltar para a Página do Estudante
                </Link>
            </div>
        );
    }
    if (status === 'error') {
        return (
            <div className="p-6 text-center">
                <h2 className="text-xl font-bold text-red-700">Falha ao Gerar Relatório</h2>
                <p className="text-gray-600 mt-2">{errorMessage}</p>
                <Link href={`/estudantes/visualizar?email=${email}&nome=${nome}`} className="br-button secondary mt-6 inline-block">
                    Voltar para a Página do Estudante
                </Link>
            </div>
        );
    }
    return null;
}
