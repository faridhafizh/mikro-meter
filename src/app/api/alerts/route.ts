import { NextResponse } from 'next/server';
import { getAlertRules, saveAlertRule, AlertRule, getRouters } from '@/lib/dataStore';

export async function GET() {
  const rules = getAlertRules();
  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, routerId, interfaceName, metric, operator, threshold, isActive } = body;

    if (!routerId || !metric || !operator || threshold === undefined) {
      return NextResponse.json({ error: 'Missing required alert rule fields' }, { status: 400 });
    }

    const routers = getRouters();
    const router = routers.find(r => r.id === routerId);
    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    const newRule: AlertRule = {
      id: id || `rule-${Date.now()}`,
      routerId,
      routerName: router.name,
      interfaceName: interfaceName || '',
      metric,
      operator,
      threshold: Number(threshold),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      isTriggered: false,
    };

    saveAlertRule(newRule);
    return NextResponse.json(newRule, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
